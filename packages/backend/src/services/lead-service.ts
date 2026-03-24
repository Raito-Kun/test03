import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { buildScopeWhere } from '../middleware/data-scope-middleware';
import { logAudit } from '../lib/audit';
import { Request } from 'express';

const leadSelect = {
  id: true,
  contactId: true,
  campaignId: true,
  status: true,
  score: true,
  assignedTo: true,
  nextFollowUp: true,
  notes: true,
  lostReason: true,
  wonAmount: true,
  createdAt: true,
  updatedAt: true,
  contact: { select: { id: true, fullName: true, phone: true } },
  campaign: { select: { id: true, name: true } },
  assignedUser: { select: { id: true, fullName: true } },
};

interface ListLeadsFilter {
  status?: string;
  campaignId?: string;
  assignedTo?: string;
  search?: string;
}

export async function listLeads(
  pagination: PaginationParams,
  filters: ListLeadsFilter,
  dataScope: Record<string, unknown>,
) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo');
  const where: Record<string, unknown> = { ...scopeWhere };

  if (filters.status) where.status = filters.status;
  if (filters.campaignId) where.campaignId = filters.campaignId;
  if (filters.assignedTo) where.assignedTo = filters.assignedTo;
  if (filters.search) {
    where.contact = { fullName: { contains: filters.search, mode: 'insensitive' } };
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({ where, select: leadSelect, skip: pagination.skip, take: pagination.limit, orderBy: pagination.orderBy }),
    prisma.lead.count({ where }),
  ]);

  return paginatedResponse(leads, total, pagination.page, pagination.limit);
}

interface CreateLeadInput {
  contactId: string;
  campaignId?: string;
  status?: string;
  score?: number;
  assignedTo?: string;
  nextFollowUp?: string;
  notes?: string;
}

export async function createLead(input: CreateLeadInput, userId: string, req?: Request) {
  const lead = await prisma.lead.create({
    data: {
      contactId: input.contactId,
      campaignId: input.campaignId || null,
      status: (input.status as never) || 'new',
      score: input.score || 0,
      assignedTo: input.assignedTo || userId,
      nextFollowUp: input.nextFollowUp ? new Date(input.nextFollowUp) : null,
      notes: input.notes || null,
    },
    select: leadSelect,
  });

  logAudit(userId, 'create', 'leads', lead.id, { new: input }, req);
  return lead;
}

export async function updateLead(
  id: string,
  input: Partial<CreateLeadInput> & { lostReason?: string; wonAmount?: number },
  userId: string,
  dataScope: Record<string, unknown>,
  req?: Request,
) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo');
  const existing = await prisma.lead.findFirst({ where: { id, ...scopeWhere } });
  if (!existing) throw Object.assign(new Error('Lead not found'), { code: 'NOT_FOUND' });

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(input.status && { status: input.status as never }),
      ...(input.score !== undefined && { score: input.score }),
      ...(input.assignedTo !== undefined && { assignedTo: input.assignedTo || null }),
      ...(input.nextFollowUp !== undefined && { nextFollowUp: input.nextFollowUp ? new Date(input.nextFollowUp) : null }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
      ...(input.lostReason !== undefined && { lostReason: input.lostReason || null }),
      ...(input.wonAmount !== undefined && { wonAmount: input.wonAmount }),
    },
    select: leadSelect,
  });

  logAudit(userId, 'update', 'leads', id, { changes: input }, req);
  return lead;
}
