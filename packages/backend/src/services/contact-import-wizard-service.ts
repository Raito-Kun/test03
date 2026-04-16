import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { getActiveClusterId } from '../lib/active-cluster';
import type { ContactImportRow } from './contact-import-parser';

/**
 * 3-step wizard: parse → check duplicates → commit with per-row actions.
 * Dedup is phone-based and matches the legacy one-shot importer's join key.
 */

export type DuplicateAction = 'create' | 'overwrite' | 'merge' | 'skip' | 'keep';

export interface ExistingContactSnapshot {
  id: string;
  fullName: string;
  phone: string;
  phoneAlt: string | null;
  email: string | null;
  idNumber: string | null;
  address: string | null;
  company: string | null;
  source: string | null;
  assignedTo: string | null;
}

export interface DuplicateEntry {
  rowNumber: number;
  new: ContactImportRow;
  existing: ExistingContactSnapshot;
}

export interface InternalDuplicateEntry {
  rowNumber: number;
  new: ContactImportRow;
  /** Row number of the first occurrence in the upload that owns this phone. */
  firstOccurrenceRow: number;
}

export interface DedupResult {
  uniques: ContactImportRow[];
  duplicates: DuplicateEntry[];
  /** Rows whose phone repeats earlier in the same upload — default action: skip. */
  internalDuplicates: InternalDuplicateEntry[];
}

export interface CommitRowInput {
  row: ContactImportRow;
  action: DuplicateAction;
  existingId?: string;
  assignToUserId?: string | null;
}

export interface CommitResult {
  created: number;
  updated: number;
  skipped: number;
  assigned: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Three-way classification:
 *  - internalDuplicates: rows whose phone repeats earlier in the SAME upload
 *  - duplicates: first-occurrence rows whose phone already exists in DB
 *  - uniques: first-occurrence rows whose phone is new to DB
 *
 * Splitting in-batch dupes out prevents the prior bug where 3 rows sharing
 * a phone all looked like 3 separate DB conflicts (or all got created and
 * silently produced duplicates because phone has @@index, not @@unique).
 */
export async function checkDuplicates(rows: ContactImportRow[]): Promise<DedupResult> {
  const firstOccurrence = new Map<string, number>();
  const canonical: ContactImportRow[] = [];
  const internalDuplicates: InternalDuplicateEntry[] = [];

  for (const r of rows) {
    if (!r.phone) { canonical.push(r); continue; }
    const seenAt = firstOccurrence.get(r.phone);
    if (seenAt === undefined) {
      firstOccurrence.set(r.phone, r.rowNumber);
      canonical.push(r);
    } else {
      internalDuplicates.push({ rowNumber: r.rowNumber, new: r, firstOccurrenceRow: seenAt });
    }
  }

  const phones = Array.from(firstOccurrence.keys());
  if (phones.length === 0) return { uniques: canonical, duplicates: [], internalDuplicates };

  const existing = await prisma.contact.findMany({
    where: { phone: { in: phones } },
    select: {
      id: true, fullName: true, phone: true, phoneAlt: true, email: true,
      idNumber: true, address: true, company: true, source: true, assignedTo: true,
    },
  });
  const byPhone = new Map(existing.map((c) => [c.phone, c]));

  const uniques: ContactImportRow[] = [];
  const duplicates: DuplicateEntry[] = [];
  for (const r of canonical) {
    const match = byPhone.get(r.phone);
    if (match) duplicates.push({ rowNumber: r.rowNumber, new: r, existing: match });
    else uniques.push(r);
  }

  // Diagnostic logging — trace miscount reports back to the source.
  // Logs phone-level decision so "5 duplicates when I expected 3" can be
  // compared against actual DB rows without another deployment cycle.
  logger.info('Contact wizard dedup check', {
    totalRows: rows.length,
    canonicalRows: canonical.length,
    internalDuplicates: internalDuplicates.length,
    phonesQueried: phones.length,
    dbMatches: existing.length,
    uniques: uniques.length,
    dbDuplicates: duplicates.length,
    matchedPhones: existing.map((c) => c.phone),
  });

  return { uniques, duplicates, internalDuplicates };
}

/** Build update payload for 'merge' — keep existing non-null fields, fill null with new. */
function mergeData(existing: ExistingContactSnapshot, next: ContactImportRow): Record<string, unknown> {
  const pick = <K extends keyof ContactImportRow>(key: K, currentVal: unknown) =>
    currentVal === null || currentVal === undefined || currentVal === '' ? next[key] : undefined;

  const data: Record<string, unknown> = {};
  const maybeSet = (k: string, v: unknown) => { if (v !== undefined) data[k] = v; };

  maybeSet('phoneAlt', pick('phoneAlt', existing.phoneAlt));
  maybeSet('email', pick('email', existing.email));
  maybeSet('idNumber', pick('idNumber', existing.idNumber));
  maybeSet('address', pick('address', existing.address));
  maybeSet('company', pick('company', existing.company));
  return data;
}

/** Build full contact payload (for create or overwrite). */
function toContactData(r: ContactImportRow): Record<string, unknown> {
  return {
    fullName: r.fullName, phone: r.phone, phoneAlt: r.phoneAlt,
    email: r.email, idNumber: r.idNumber, address: r.address,
    province: r.province, district: r.district, occupation: r.occupation,
    income: r.income, company: r.company, jobTitle: r.jobTitle,
    companyEmail: r.companyEmail, bankName: r.bankName, bankAccount: r.bankAccount,
    creditLimit: r.creditLimit, dateOfBirth: r.dateOfBirth, gender: r.gender,
    source: r.source || 'import', tags: r.tags || [], internalNotes: r.internalNotes,
  };
}

/**
 * Commit processed rows to the database.
 * Each input row carries its own action (create/overwrite/merge/skip/keep) and
 * optional per-row assigneeId. Errors are collected per-row, never thrown.
 *
 * Resolves the active cluster once and stamps every created contact with it,
 * matching the regular createContact path. Without this, wizard-created
 * contacts get clusterId=null and become invisible in the cluster-filtered list.
 */
export async function commitWizardRows(
  inputs: CommitRowInput[],
  userId: string,
  userClusterId?: string | null,
): Promise<CommitResult> {
  const result: CommitResult = { created: 0, updated: 0, skipped: 0, assigned: 0, errors: [] };
  const clusterId = await getActiveClusterId(userClusterId);

  for (const input of inputs) {
    const { row, action, existingId, assignToUserId } = input;
    try {
      const assignTo = assignToUserId || undefined;

      switch (action) {
        case 'skip':
        case 'keep':
          result.skipped++;
          break;

        case 'create': {
          const data = toContactData(row);
          await prisma.contact.create({
            data: { ...data, clusterId, createdBy: userId, assignedTo: assignTo ?? null } as never,
          });
          result.created++;
          if (assignTo) result.assigned++;
          break;
        }

        case 'overwrite': {
          if (!existingId) { result.errors.push({ row: row.rowNumber, error: 'Missing existingId for overwrite' }); break; }
          const data = toContactData(row);
          await prisma.contact.update({
            where: { id: existingId },
            data: { ...data, ...(assignTo ? { assignedTo: assignTo } : {}) } as never,
          });
          result.updated++;
          if (assignTo) result.assigned++;
          break;
        }

        case 'merge': {
          if (!existingId) { result.errors.push({ row: row.rowNumber, error: 'Missing existingId for merge' }); break; }
          const existing = await prisma.contact.findUnique({ where: { id: existingId } });
          if (!existing) { result.errors.push({ row: row.rowNumber, error: 'Existing contact not found' }); break; }
          const data = mergeData(existing as unknown as ExistingContactSnapshot, row);
          if (assignTo) data.assignedTo = assignTo;
          if (Object.keys(data).length > 0) {
            await prisma.contact.update({ where: { id: existingId }, data: data as never });
          }
          result.updated++;
          if (assignTo) result.assigned++;
          break;
        }
      }
    } catch (err) {
      result.errors.push({ row: row.rowNumber, error: (err as Error).message.slice(0, 200) });
    }
  }

  logger.info('Contact wizard import committed', {
    created: result.created, updated: result.updated, skipped: result.skipped, assigned: result.assigned,
  });
  return result;
}
