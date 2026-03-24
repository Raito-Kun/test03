import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { buildScopeWhere } from '../middleware/data-scope-middleware';
import { logAudit } from '../lib/audit';
import { Request } from 'express';

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
}

export async function listContacts(
  pagination: PaginationParams,
  filters: ListContactsFilter,
  dataScope: Record<string, unknown>,
) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo');
  const where: Record<string, unknown> = { ...scopeWhere };

  if (filters.source) where.source = filters.source;
  if (filters.assignedTo) where.assignedTo = filters.assignedTo;
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
}

export async function createContact(input: CreateContactInput, userId: string, req?: Request) {
  const contact = await prisma.contact.create({
    data: {
      fullName: input.fullName,
      phone: input.phone,
      phoneAlt: input.phoneAlt || null,
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
    },
    select: contactSelect,
  });

  logAudit(userId, 'create', 'contacts', contact.id, { new: input }, req);
  return contact;
}

export async function getContactById(id: string, dataScope: Record<string, unknown>) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo');
  const contact = await prisma.contact.findFirst({
    where: { id, ...scopeWhere },
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
) {
  // IDOR protection: verify access via data scope
  await getContactById(id, dataScope);

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...(input.fullName && { fullName: input.fullName }),
      ...(input.phone && { phone: input.phone }),
      ...(input.phoneAlt !== undefined && { phoneAlt: input.phoneAlt || null }),
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
) {
  await getContactById(id, dataScope);
  await prisma.contact.delete({ where: { id } });
  logAudit(userId, 'delete', 'contacts', id, null, req);
}

/** Get contact timeline: calls + tickets + leads + debt cases ordered by date */
export async function getContactTimeline(id: string, dataScope: Record<string, unknown>) {
  await getContactById(id, dataScope);

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
