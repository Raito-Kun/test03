import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { buildScopeWhere } from '../middleware/data-scope-middleware';
import { logAudit } from '../lib/audit';
import { getActiveClusterId } from '../lib/active-cluster';
import { Request } from 'express';

/** Ensure Vietnamese phone numbers have leading 0 (9xxxxxxxx → 09xxxxxxxx).
 *  Exported so the CSV import parser can produce the same canonical string
 *  that the UI-create path writes to DB — otherwise dedup matching may miss. */
export function ensureLeadingZero(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
  if (/^\d{9}$/.test(cleaned) && !cleaned.startsWith('0')) return `0${cleaned}`;
  return cleaned;
}

const contactSelect = {
  id: true,
  fullName: true,
  phone: true,
  phoneAlt: true,
  email: true,
  idNumber: true,
  address: true,
  dateOfBirth: true,
  gender: true,
  source: true,
  tags: true,
  customFields: true,
  occupation: true,
  income: true,
  province: true,
  district: true,
  fullAddress: true,
  company: true,
  jobTitle: true,
  companyEmail: true,
  creditLimit: true,
  bankAccount: true,
  bankName: true,
  internalNotes: true,
  assignedTo: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  assignedUser: { select: { id: true, fullName: true } },
};

interface ListContactsFilter {
  search?: string;
  source?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function listContacts(
  pagination: PaginationParams,
  filters: ListContactsFilter,
  dataScope: Record<string, unknown>,
  userClusterId?: string | null,
) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo');
  const clusterId = await getActiveClusterId(userClusterId);
  const where: Record<string, unknown> = { ...scopeWhere, ...(clusterId && { clusterId }) };

  if (filters.source) where.source = filters.source;
  if (filters.assignedTo) where.assignedTo = filters.assignedTo;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
      ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
    };
  }
  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search } },
      { idNumber: { contains: filters.search } },
    ];
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      select: contactSelect,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: pagination.orderBy,
    }),
    prisma.contact.count({ where }),
  ]);

  return paginatedResponse(contacts, total, pagination.page, pagination.limit);
}

interface CreateContactInput {
  fullName: string;
  phone: string;
  phoneAlt?: string;
  email?: string;
  idNumber?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  source?: string;
  tags?: unknown;
  customFields?: unknown;
  assignedTo?: string;
  occupation?: string;
  income?: number;
  province?: string;
  district?: string;
  fullAddress?: string;
  company?: string;
  jobTitle?: string;
  companyEmail?: string;
  creditLimit?: number;
  bankAccount?: string;
  bankName?: string;
  internalNotes?: string;
}

export async function createContact(input: CreateContactInput, userId: string, req?: Request, userClusterId?: string | null) {
  const clusterId = await getActiveClusterId(userClusterId);
  const contact = await prisma.contact.create({
    data: {
      clusterId,
      fullName: input.fullName,
      phone: ensureLeadingZero(input.phone) || input.phone,
      phoneAlt: ensureLeadingZero(input.phoneAlt) || null,
      email: input.email || null,
      idNumber: input.idNumber || null,
      address: input.address || null,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      gender: (input.gender as never) || null,
      source: input.source || null,
      tags: input.tags ?? undefined,
      customFields: input.customFields ?? undefined,
      assignedTo: input.assignedTo || null,
      createdBy: userId,
      occupation: input.occupation || null,
      income: input.income != null ? input.income : null,
      province: input.province || null,
      district: input.district || null,
      fullAddress: input.fullAddress || null,
      company: input.company || null,
      jobTitle: input.jobTitle || null,
      companyEmail: input.companyEmail || null,
      creditLimit: input.creditLimit != null ? input.creditLimit : null,
      bankAccount: input.bankAccount || null,
      bankName: input.bankName || null,
      internalNotes: input.internalNotes || null,
    },
    select: contactSelect,
  });

  logAudit(userId, 'create', 'contacts', contact.id, { new: input }, req);
  return contact;
}

export async function getContactById(id: string, dataScope: Record<string, unknown>, userClusterId?: string | null) {
  const clusterId = await getActiveClusterId(userClusterId);
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo');
  const contact = await prisma.contact.findFirst({
    where: { id, ...scopeWhere, ...(clusterId && { clusterId }) },
    select: {
      ...contactSelect,
      relationshipsFrom: {
        select: {
          id: true,
          relatedContactId: true,
          relationshipType: true,
          notes: true,
          relatedContact: { select: { id: true, fullName: true, phone: true } },
        },
      },
    },
  });

  if (!contact) {
    throw Object.assign(new Error('Contact not found'), { code: 'NOT_FOUND' });
  }
  return contact;
}

export async function updateContact(
  id: string,
  input: Partial<CreateContactInput>,
  userId: string,
  dataScope: Record<string, unknown>,
  req?: Request,
  userClusterId?: string | null,
) {
  // IDOR protection: verify access via data scope
  await getContactById(id, dataScope, userClusterId);

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...(input.fullName && { fullName: input.fullName }),
      ...(input.phone && { phone: ensureLeadingZero(input.phone) || input.phone }),
      ...(input.phoneAlt !== undefined && { phoneAlt: ensureLeadingZero(input.phoneAlt) || null }),
      ...(input.email !== undefined && { email: input.email || null }),
      ...(input.idNumber !== undefined && { idNumber: input.idNumber || null }),
      ...(input.address !== undefined && { address: input.address || null }),
      ...(input.dateOfBirth !== undefined && {
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      }),
      ...(input.gender !== undefined && { gender: (input.gender as never) || null }),
      ...(input.source !== undefined && { source: input.source || null }),
      ...(input.tags !== undefined && { tags: input.tags ?? undefined }),
      ...(input.assignedTo !== undefined && { assignedTo: input.assignedTo || null }),
      ...(input.occupation !== undefined && { occupation: input.occupation || null }),
      ...(input.income !== undefined && { income: input.income != null ? input.income : null }),
      ...(input.province !== undefined && { province: input.province || null }),
      ...(input.district !== undefined && { district: input.district || null }),
      ...(input.fullAddress !== undefined && { fullAddress: input.fullAddress || null }),
      ...(input.company !== undefined && { company: input.company || null }),
      ...(input.jobTitle !== undefined && { jobTitle: input.jobTitle || null }),
      ...(input.companyEmail !== undefined && { companyEmail: input.companyEmail || null }),
      ...(input.creditLimit !== undefined && { creditLimit: input.creditLimit != null ? input.creditLimit : null }),
      ...(input.bankAccount !== undefined && { bankAccount: input.bankAccount || null }),
      ...(input.bankName !== undefined && { bankName: input.bankName || null }),
      ...(input.internalNotes !== undefined && { internalNotes: input.internalNotes || null }),
    },
    select: contactSelect,
  });

  logAudit(userId, 'update', 'contacts', id, { changes: input }, req);
  return contact;
}

export async function deleteContact(
  id: string,
  userId: string,
  dataScope: Record<string, unknown>,
  req?: Request,
  userClusterId?: string | null,
) {
  await getContactById(id, dataScope, userClusterId);
  // Cascade cleanup — delete/unlink dependents to avoid FK constraint violations
  // Non-nullable FK: delete dependent records
  await prisma.lead.deleteMany({ where: { contactId: id } });
  await prisma.debtCase.deleteMany({ where: { contactId: id } });
  await prisma.ticket.deleteMany({ where: { contactId: id } });
  // Nullable FK: unlink without deleting call history
  await prisma.callLog.updateMany({ where: { contactId: id }, data: { contactId: null } });
  // Delete contact relationship links
  await prisma.contactRelationship.deleteMany({ where: { OR: [{ contactId: id }, { relatedContactId: id }] } });
  await prisma.contact.delete({ where: { id } });
  logAudit(userId, 'delete', 'contacts', id, null, req);
}

/** Get contact timeline: calls + tickets + leads + debt cases ordered by date */
export async function getContactTimeline(id: string, dataScope: Record<string, unknown>, userClusterId?: string | null) {
  await getContactById(id, dataScope, userClusterId);

  const [calls, tickets, leads, debtCases] = await Promise.all([
    prisma.callLog.findMany({
      where: { contactId: id },
      select: { id: true, direction: true, callerNumber: true, destinationNumber: true, startTime: true, duration: true, hangupCause: true },
      orderBy: { startTime: 'desc' },
      take: 50,
    }),
    prisma.ticket.findMany({
      where: { contactId: id },
      select: { id: true, subject: true, status: true, priority: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.lead.findMany({
      where: { contactId: id },
      select: { id: true, status: true, score: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.debtCase.findMany({
      where: { contactId: id },
      select: { id: true, status: true, tier: true, outstandingAmount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  // Merge into unified timeline sorted by date
  const timeline = [
    ...calls.map((c) => ({ type: 'call' as const, date: c.startTime, data: c })),
    ...tickets.map((t) => ({ type: 'ticket' as const, date: t.createdAt, data: t })),
    ...leads.map((l) => ({ type: 'lead' as const, date: l.updatedAt, data: l })),
    ...debtCases.map((d) => ({ type: 'debt_case' as const, date: d.createdAt, data: d })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return timeline;
}
