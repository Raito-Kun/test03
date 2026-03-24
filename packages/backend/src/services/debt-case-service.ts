import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { buildScopeWhere } from '../middleware/data-scope-middleware';
import { logAudit } from '../lib/audit';
import { Request } from 'express';

const debtCaseSelect = {
  id: true,
  contactId: true,
  campaignId: true,
  originalAmount: true,
  outstandingAmount: true,
  dpd: true,
  tier: true,
  status: true,
  assignedTo: true,
  promiseDate: true,
  promiseAmount: true,
  createdAt: true,
  updatedAt: true,
  contact: { select: { id: true, fullName: true, phone: true } },
  campaign: { select: { id: true, name: true } },
  assignedUser: { select: { id: true, fullName: true } },
};

interface ListDebtCasesFilter {
  status?: string;
  tier?: string;
  campaignId?: string;
  assignedTo?: string;
}

export async function listDebtCases(
  pagination: PaginationParams,
  filters: ListDebtCasesFilter,
  dataScope: Record<string, unknown>,
) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo');
  const where: Record<string, unknown> = { ...scopeWhere };

  if (filters.status) where.status = filters.status;
  if (filters.tier) where.tier = filters.tier;
  if (filters.campaignId) where.campaignId = filters.campaignId;
  if (filters.assignedTo) where.assignedTo = filters.assignedTo;

  const [cases, total] = await Promise.all([
    prisma.debtCase.findMany({ where, select: debtCaseSelect, skip: pagination.skip, take: pagination.limit, orderBy: pagination.orderBy }),
    prisma.debtCase.count({ where }),
  ]);

  return paginatedResponse(cases, total, pagination.page, pagination.limit);
}

interface CreateDebtCaseInput {
  contactId: string;
  campaignId?: string;
  originalAmount: number;
  outstandingAmount: number;
  dpd?: number;
  assignedTo?: string;
}

export async function createDebtCase(input: CreateDebtCaseInput, userId: string, req?: Request) {
  // Auto-calculate tier from DPD
  const dpd = input.dpd || 0;
  const tier = dpd <= 0 ? 'current' : dpd <= 30 ? 'dpd_1_30' : dpd <= 60 ? 'dpd_31_60' : dpd <= 90 ? 'dpd_61_90' : 'dpd_90_plus';

  const debtCase = await prisma.debtCase.create({
    data: {
      contactId: input.contactId,
      campaignId: input.campaignId || null,
      originalAmount: input.originalAmount,
      outstandingAmount: input.outstandingAmount,
      dpd,
      tier: tier as never,
      assignedTo: input.assignedTo || userId,
    },
    select: debtCaseSelect,
  });

  logAudit(userId, 'create', 'debt_cases', debtCase.id, { new: input }, req);
  return debtCase;
}

export async function updateDebtCase(
  id: string,
  input: Partial<CreateDebtCaseInput> & { status?: string },
  userId: string,
  dataScope: Record<string, unknown>,
  req?: Request,
) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo');
  const existing = await prisma.debtCase.findFirst({ where: { id, ...scopeWhere } });
  if (!existing) throw Object.assign(new Error('Debt case not found'), { code: 'NOT_FOUND' });

  // Recalculate tier if dpd changes
  const dpd = input.dpd ?? existing.dpd;
  const tier = dpd <= 0 ? 'current' : dpd <= 30 ? 'dpd_1_30' : dpd <= 60 ? 'dpd_31_60' : dpd <= 90 ? 'dpd_61_90' : 'dpd_90_plus';

  const debtCase = await prisma.debtCase.update({
    where: { id },
    data: {
      ...(input.status && { status: input.status as never }),
      ...(input.dpd !== undefined && { dpd, tier: tier as never }),
      ...(input.outstandingAmount !== undefined && { outstandingAmount: input.outstandingAmount }),
      ...(input.assignedTo !== undefined && { assignedTo: input.assignedTo || null }),
    },
    select: debtCaseSelect,
  });

  logAudit(userId, 'update', 'debt_cases', id, { changes: input }, req);
  return debtCase;
}

/** Record Promise to Pay */
export async function recordPTP(
  id: string,
  promiseDate: string,
  promiseAmount: number,
  userId: string,
  dataScope: Record<string, unknown>,
  req?: Request,
) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo');
  const existing = await prisma.debtCase.findFirst({ where: { id, ...scopeWhere } });
  if (!existing) throw Object.assign(new Error('Debt case not found'), { code: 'NOT_FOUND' });

  const debtCase = await prisma.debtCase.update({
    where: { id },
    data: {
      status: 'promise_to_pay',
      promiseDate: new Date(promiseDate),
      promiseAmount,
    },
    select: debtCaseSelect,
  });

  logAudit(userId, 'update', 'debt_cases', id, { action: 'ptp', promiseDate, promiseAmount }, req);
  return debtCase;
}
