import * as XLSX from 'xlsx';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

/** Find or create contact by phone, return contactId */
async function resolveContact(phone: string, name: string): Promise<string> {
  const existing = await prisma.contact.findFirst({ where: { phone }, select: { id: true } });
  if (existing) return existing.id;

  const contact = await prisma.contact.create({
    data: { fullName: name, phone, source: 'import' },
    select: { id: true },
  });
  return contact.id;
}

/** Import leads from CSV/XLSX buffer */
export async function importLeads(buffer: Buffer, userId: string): Promise<ImportResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    // Normalize header keys (strip markers like " (*required)")
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const clean = k.replace(/\s*\(.*?\)/g, '').trim();
      data[clean] = String(v ?? '').trim();
    }

    const phone = data['contactPhone'];
    const name = data['contactName'];

    if (!phone || !name) {
      result.errors.push({ row: rowNum, error: 'Thiếu contactPhone hoặc contactName' });
      result.skipped++;
      continue;
    }

    try {
      const contactId = await resolveContact(phone, name);
      const rawStatus = data['status']?.toLowerCase();
      const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'new';
      const wonAmount = data['value'] ? parseFloat(data['value']) : undefined;

      await prisma.lead.create({
        data: {
          contactId,
          status: status as any,
          wonAmount: wonAmount && !isNaN(wonAmount) ? wonAmount : undefined,
          notes: data['notes'] || undefined,
          assignedTo: userId,
        },
      });
      result.imported++;
    } catch (err) {
      result.errors.push({ row: rowNum, error: (err as Error).message });
      result.skipped++;
    }
  }

  logger.info('Lead import complete', result);
  return result;
}
