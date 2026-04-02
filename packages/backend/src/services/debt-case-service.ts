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
  contractNumber: true,
  debtType: true,
  paidAmount: true,
  remainingAmount: true,
  debtGroup: true,
  dueDate: true,
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
  search?: string;
  dateFrom?: string;
  dateTo?: string;
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
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
      ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
    };
  }
  if (filters.search) {
    where.contact = { fullName: { contains: filters.search, mode: 'insensitive' } };
  }

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
  contractNumber?: string;
  debtType?: string;
  paidAmount?: number;
  remainingAmount?: number;
  debtGroup?: string;
  dueDate?: string;
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
      contractNumber: input.contractNumber || null,
      debtType: input.debtType || null,
      paidAmount: input.paidAmount ?? 0,
      remainingAmount: input.remainingAmount ?? null,
      debtGroup: input.debtGroup || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
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
      ...(input.contractNumber !== undefined && { contractNumber: input.contractNumber || null }),
      ...(input.debtType !== undefined && { debtType: input.debtType || null }),
      ...(input.paidAmount !== undefined && { paidAmount: input.paidAmount }),
      ...(input.remainingAmount !== undefined && { remainingAmount: input.remainingAmount ?? null }),
      ...(input.debtGroup !== undefined && { debtGroup: input.debtGroup || null }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate ? new Date(input.dueDate) : null }),
      ...(input.assignedTo !== undefined && { assignedTo: input.assignedTo || null }),
    },
    select: debtCaseSelect,
  });

  logAudit(userId, 'update', 'debt_cases', id, { changes: input }, req);
  return debtCase;
}

/** Derive tier label from DPD value */
function tierFromDpd(dpd: number): string {
  if (dpd <= 0) return 'current';
  if (dpd <= 30) return 'dpd_1_30';
  if (dpd <= 60) return 'dpd_31_60';
  if (dpd <= 90) return 'dpd_61_90';
  return 'dpd_90_plus';
}

interface EscalationResult {
  checked: number;
  updated: number;
  details: Array<{ id: string; oldTier: string; newTier: string; dpd: number }>;
}

/**
 * Auto-escalate debt tiers for all active cases based on dueDate vs today.
 * Called manually via POST /debt-cases/escalate (admin only).
 */
export async function escalateDebtTiers(): Promise<EscalationResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch active debt cases that have a dueDate
  const cases = await prisma.debtCase.findMany({
    where: {
      status: { notIn: ['paid', 'written_off'] },
      dueDate: { not: null },
    },
    select: { id: true, dueDate: true, dpd: true, tier: true },
  });

  const toUpdate: Array<{ id: string; dpd: number; tier: string; oldTier: string }> = [];

  for (const c of cases) {
    if (!c.dueDate) continue;
    const dueDate = new Date(c.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const dpd = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
    const newTier = tierFromDpd(dpd);

    if (dpd !== c.dpd || newTier !== c.tier) {
      toUpdate.push({ id: c.id, dpd, tier: newTier, oldTier: String(c.tier) });
    }
  }

  if (toUpdate.length > 0) {
    await prisma.$transaction(
      toUpdate.map((u) =>
        prisma.debtCase.update({
          where: { id: u.id },
          data: { dpd: u.dpd, tier: u.tier as never },
        }),
      ),
    );
  }

  return {
    checked: cases.length,
    updated: toUpdate.length,
    details: toUpdate.map((u) => ({ id: u.id, oldTier: u.oldTier, newTier: u.tier, dpd: u.dpd })),
  };
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
