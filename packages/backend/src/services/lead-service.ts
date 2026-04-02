import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { buildScopeWhere } from '../middleware/data-scope-middleware';
import { logAudit } from '../lib/audit';
import { calculateScore } from './lead-scoring-service';
import { Request } from 'express';

const leadSelect = {
  id: true,
  contactId: true,
  campaignId: true,
  status: true,
  score: true,
  leadScore: true,
  product: true,
  budget: true,
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
  dateFrom?: string;
  dateTo?: string;
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
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
      ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
    };
  }
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
  leadScore?: number;
  product?: string;
  budget?: number;
  assignedTo?: string;
  nextFollowUp?: string;
  notes?: string;
}

export async function createLead(input: CreateLeadInput, userId: string, req?: Request) {
  // Fetch contact info for scoring
  const contact = await prisma.contact.findUnique({
    where: { id: input.contactId },
    select: { phone: true, email: true, source: true },
  });

  // Count prior call interactions for this contact
  const callCount = await prisma.callLog.count({ where: { contactId: input.contactId } });

  const computedScore = calculateScore({
    status: input.status || 'new',
    source: contact?.source,
    phone: contact?.phone,
    email: contact?.email,
    callCount,
  });

  const lead = await prisma.lead.create({
    data: {
      contactId: input.contactId,
      campaignId: input.campaignId || null,
      status: (input.status as never) || 'new',
      score: input.score ?? computedScore,
      leadScore: input.leadScore ?? computedScore,
      product: input.product || null,
      budget: input.budget ?? null,
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
  const existing = await prisma.lead.findFirst({
    where: { id, ...scopeWhere },
    select: { id: true, status: true, score: true, contactId: true },
  });
  if (!existing) throw Object.assign(new Error('Lead not found'), { code: 'NOT_FOUND' });

  // Recalculate score when status changes
  let newScore: number | undefined;
  if (input.status && input.status !== existing.status) {
    const contact = await prisma.contact.findUnique({
      where: { id: existing.contactId },
      select: { phone: true, email: true, source: true },
    });
    const callCount = await prisma.callLog.count({ where: { contactId: existing.contactId } });
    newScore = calculateScore({
      status: input.status,
      source: contact?.source,
      phone: contact?.phone,
      email: contact?.email,
      callCount,
    });
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(input.status && { status: input.status as never }),
      ...(input.score !== undefined ? { score: input.score } : newScore !== undefined ? { score: newScore, leadScore: newScore } : {}),
      ...(input.leadScore !== undefined && { leadScore: input.leadScore }),
      ...(input.product !== undefined && { product: input.product || null }),
      ...(input.budget !== undefined && { budget: input.budget ?? null }),
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

/** Return leads whose nextFollowUp is today or earlier (overdue) */
export async function listFollowUps(dataScope: Record<string, unknown>) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo');
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const leads = await prisma.lead.findMany({
    where: {
      ...scopeWhere,
      nextFollowUp: { lte: today },
      status: { notIn: ['won', 'lost'] },
    },
    select: {
      ...leadSelect,
    },
    orderBy: { nextFollowUp: 'asc' },
    take: 200,
  });

  // Flag overdue vs due today
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return leads.map((lead) => ({
    ...lead,
    isOverdue: lead.nextFollowUp !== null && lead.nextFollowUp < startOfToday,
    isDueToday: lead.nextFollowUp !== null && lead.nextFollowUp >= startOfToday,
  }));
}
