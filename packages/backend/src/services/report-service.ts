import prisma from '../lib/prisma';
import { buildScopeWhere } from '../middleware/data-scope-middleware';

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
  groupBy?: 'day' | 'agent' | 'direction';
  userId?: string;
  campaignId?: string;
}

export async function getCallReport(filters: DateRangeFilter, dataScope: Record<string, unknown>) {
  const scopeWhere = buildScopeWhere(dataScope, 'userId', 'user');
  const where: Record<string, unknown> = {
    ...scopeWhere,
    startTime: {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate),
    },
  };

  if (filters.userId) where.userId = filters.userId;
  if (filters.campaignId) where.campaignId = filters.campaignId;

  const logs = await prisma.callLog.findMany({
    where,
    select: {
      id: true,
      direction: true,
      startTime: true,
      duration: true,
      billsec: true,
      hangupCause: true,
      answerTime: true,
      userId: true,
      user: { select: { id: true, fullName: true } },
      dispositionCode: { select: { id: true, code: true, label: true } },
    },
    orderBy: { startTime: 'asc' },
  });

  // Group by requested dimension
  const groupBy = filters.groupBy || 'day';

  if (groupBy === 'day') {
    const grouped: Record<string, { date: string; total: number; answered: number; totalDuration: number }> = {};

    for (const log of logs) {
      const date = log.startTime.toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = { date, total: 0, answered: 0, totalDuration: 0 };
      grouped[date].total++;
      if (log.answerTime) grouped[date].answered++;
      grouped[date].totalDuration += log.billsec;
    }

    return Object.values(grouped);
  }

  if (groupBy === 'agent') {
    const grouped: Record<string, { agentId: string; agentName: string; total: number; answered: number; totalDuration: number }> = {};

    for (const log of logs) {
      const agentId = log.userId || 'unknown';
      if (!grouped[agentId]) {
        grouped[agentId] = {
          agentId,
          agentName: log.user?.fullName || 'Unknown',
          total: 0,
          answered: 0,
          totalDuration: 0,
        };
      }
      grouped[agentId].total++;
      if (log.answerTime) grouped[agentId].answered++;
      grouped[agentId].totalDuration += log.billsec;
    }

    return Object.values(grouped);
  }

  if (groupBy === 'direction') {
    const grouped: Record<string, { direction: string; total: number; answered: number; totalDuration: number }> = {};

    for (const log of logs) {
      const dir = log.direction;
      if (!grouped[dir]) grouped[dir] = { direction: dir, total: 0, answered: 0, totalDuration: 0 };
      grouped[dir].total++;
      if (log.answerTime) grouped[dir].answered++;
      grouped[dir].totalDuration += log.billsec;
    }

    return Object.values(grouped);
  }

  return logs;
}

export async function getTelesaleReport(filters: DateRangeFilter, dataScope: Record<string, unknown>) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo', 'assignedUser');
  const leadWhere: Record<string, unknown> = {
    ...scopeWhere,
    createdAt: {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate),
    },
  };

  if (filters.userId) leadWhere.assignedTo = filters.userId;
  if (filters.campaignId) leadWhere.campaignId = filters.campaignId;

  const leads = await prisma.lead.groupBy({
    by: ['status'],
    where: leadWhere,
    _count: { id: true },
  });

  const totalLeads = leads.reduce((sum, l) => sum + l._count.id, 0);
  const wonLeads = leads.find((l) => l.status === 'won')?._count.id || 0;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  return {
    funnel: leads.map((l) => ({ status: l.status, count: l._count.id })),
    totalLeads,
    wonLeads,
    conversionRatePercent: conversionRate,
  };
}

export async function getCollectionReport(filters: DateRangeFilter, dataScope: Record<string, unknown>) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo', 'assignedUser');
  const caseWhere: Record<string, unknown> = {
    ...scopeWhere,
    createdAt: {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate),
    },
  };

  if (filters.userId) caseWhere.assignedTo = filters.userId;
  if (filters.campaignId) caseWhere.campaignId = filters.campaignId;

  const [byStatus, byTier, ptpSummary] = await Promise.all([
    prisma.debtCase.groupBy({
      by: ['status'],
      where: caseWhere,
      _count: { id: true },
      _sum: { outstandingAmount: true },
    }),
    prisma.debtCase.groupBy({
      by: ['tier'],
      where: caseWhere,
      _count: { id: true },
      _sum: { outstandingAmount: true },
    }),
    prisma.debtCase.aggregate({
      where: { ...caseWhere, status: 'promise_to_pay', promiseDate: { not: null } },
      _count: { id: true },
      _sum: { promiseAmount: true },
    }),
  ]);

  const paidCases = byStatus.find((s) => s.status === 'paid');
  const totalCases = byStatus.reduce((sum, s) => sum + s._count.id, 0);
  const recoveryRate = totalCases > 0
    ? Math.round(((paidCases?._count.id || 0) / totalCases) * 100)
    : 0;

  return {
    byStatus: byStatus.map((s) => ({
      status: s.status,
      count: s._count.id,
      totalOutstanding: s._sum.outstandingAmount,
    })),
    byTier: byTier.map((t) => ({
      tier: t.tier,
      count: t._count.id,
      totalOutstanding: t._sum.outstandingAmount,
    })),
    promiseToPay: {
      count: ptpSummary._count.id,
      totalAmount: ptpSummary._sum.promiseAmount,
    },
    recoveryRatePercent: recoveryRate,
  };
}
