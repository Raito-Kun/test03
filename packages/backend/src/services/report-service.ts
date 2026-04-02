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
      lte: new Date(filters.endDate + 'T23:59:59.999Z'),
    },
  };

  if (filters.userId) where.userId = filters.userId;
  if (filters.campaignId) where.campaignId = filters.campaignId;

  const logs = await prisma.callLog.findMany({
    where,
    select: {
      id: true, direction: true, startTime: true, duration: true,
      billsec: true, hangupCause: true, answerTime: true, userId: true,
      user: { select: { id: true, fullName: true } },
    },
    orderBy: { startTime: 'asc' },
  });

  const groupBy = filters.groupBy || 'agent';

  if (groupBy === 'agent') {
    const grouped: Record<string, { agentName: string; total: number; answered: number; missed: number; totalDuration: number }> = {};
    for (const log of logs) {
      const agentId = log.userId || 'unknown';
      if (!grouped[agentId]) {
        grouped[agentId] = {
          agentName: log.user?.fullName || 'Không xác định',
          total: 0, answered: 0, missed: 0, totalDuration: 0,
        };
      }
      grouped[agentId].total++;
      if (log.answerTime) {
        grouped[agentId].answered++;
        grouped[agentId].totalDuration += log.billsec;
      } else {
        grouped[agentId].missed++;
      }
    }
    return Object.values(grouped).map((g) => ({
      agentName: g.agentName,
      totalCalls: g.total,
      answered: g.answered,
      missed: g.missed,
      avgDuration: g.answered > 0 ? Math.round(g.totalDuration / g.answered) : 0,
    }));
  }

  if (groupBy === 'day') {
    const grouped: Record<string, { date: string; total: number; answered: number; missed: number; totalDuration: number }> = {};
    for (const log of logs) {
      const date = log.startTime.toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = { date, total: 0, answered: 0, missed: 0, totalDuration: 0 };
      grouped[date].total++;
      if (log.answerTime) {
        grouped[date].answered++;
        grouped[date].totalDuration += log.billsec;
      } else {
        grouped[date].missed++;
      }
    }
    return Object.values(grouped);
  }

  if (groupBy === 'direction') {
    const grouped: Record<string, { direction: string; total: number; answered: number; missed: number; totalDuration: number }> = {};
    for (const log of logs) {
      const dir = log.direction;
      if (!grouped[dir]) grouped[dir] = { direction: dir, total: 0, answered: 0, missed: 0, totalDuration: 0 };
      grouped[dir].total++;
      if (log.answerTime) {
        grouped[dir].answered++;
        grouped[dir].totalDuration += log.billsec;
      } else {
        grouped[dir].missed++;
      }
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
      lte: new Date(filters.endDate + 'T23:59:59.999Z'),
    },
  };

  if (filters.userId) leadWhere.assignedTo = filters.userId;
  if (filters.campaignId) leadWhere.campaignId = filters.campaignId;

  const leads = await prisma.lead.findMany({
    where: leadWhere,
    select: {
      id: true, status: true, assignedTo: true,
      assignedUser: { select: { id: true, fullName: true } },
    },
  });

  // Per-agent grouping
  const grouped: Record<string, {
    agentName: string; total: number; contacted: number;
    qualified: number; won: number;
  }> = {};

  for (const lead of leads) {
    const agentId = lead.assignedTo || 'unassigned';
    if (!grouped[agentId]) {
      grouped[agentId] = {
        agentName: lead.assignedUser?.fullName || 'Chưa phân công',
        total: 0, contacted: 0, qualified: 0, won: 0,
      };
    }
    grouped[agentId].total++;
    if (lead.status === 'contacted' || lead.status === 'qualified' || lead.status === 'won') {
      grouped[agentId].contacted++;
    }
    if (lead.status === 'qualified' || lead.status === 'won') {
      grouped[agentId].qualified++;
    }
    if (lead.status === 'won') {
      grouped[agentId].won++;
    }
  }

  return Object.values(grouped).map((g) => ({
    agentName: g.agentName,
    totalLeads: g.total,
    contacted: g.contacted,
    qualified: g.qualified,
    won: g.won,
    conversionRate: g.total > 0 ? g.won / g.total : 0,
  }));
}

export async function getSlaReport(filters: DateRangeFilter, dataScope: Record<string, unknown>) {
  const scopeWhere = buildScopeWhere(dataScope, 'userId', 'user');
  const where: Record<string, unknown> = {
    ...scopeWhere,
    createdAt: {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate + 'T23:59:59.999Z'),
    },
  };

  if (filters.userId) where.userId = filters.userId;

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      id: true, status: true, priority: true,
      createdAt: true, updatedAt: true,
    },
    take: 5000,
  });

  const SLA_FIRST_RESPONSE: Record<string, number> = { urgent: 1, high: 4, medium: 8, low: 24 };
  const SLA_RESOLUTION: Record<string, number> = { urgent: 4, high: 24, medium: 72, low: 168 };

  let totalTickets = 0;
  let withinFirstResponseSla = 0;
  let withinResolutionSla = 0;
  let totalFirstResponseMs = 0;
  let totalResolutionMs = 0;
  let resolvedCount = 0;

  for (const ticket of tickets) {
    totalTickets++;
    const priority = ticket.priority as string;
    const firstResponseThresholdMs = (SLA_FIRST_RESPONSE[priority] || 8) * 3600000;
    const resolutionThresholdMs = (SLA_RESOLUTION[priority] || 72) * 3600000;
    const firstResponseMs = ticket.updatedAt.getTime() - ticket.createdAt.getTime();
    totalFirstResponseMs += firstResponseMs;
    if (firstResponseMs <= firstResponseThresholdMs) withinFirstResponseSla++;
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      resolvedCount++;
      const resolutionMs = ticket.updatedAt.getTime() - ticket.createdAt.getTime();
      totalResolutionMs += resolutionMs;
      if (resolutionMs <= resolutionThresholdMs) withinResolutionSla++;
    }
  }

  const avgFirstResponseHours = totalTickets > 0
    ? Math.round((totalFirstResponseMs / totalTickets / 3600000) * 10) / 10 : 0;
  const avgResolutionHours = resolvedCount > 0
    ? Math.round((totalResolutionMs / resolvedCount / 3600000) * 10) / 10 : 0;

  const byPriority: Record<string, { total: number; resolved: number; withinSla: number }> = {};
  for (const ticket of tickets) {
    const p = ticket.priority as string;
    if (!byPriority[p]) byPriority[p] = { total: 0, resolved: 0, withinSla: 0 };
    byPriority[p].total++;
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      byPriority[p].resolved++;
      const resMs = ticket.updatedAt.getTime() - ticket.createdAt.getTime();
      const threshold = (SLA_RESOLUTION[p] || 72) * 3600000;
      if (resMs <= threshold) byPriority[p].withinSla++;
    }
  }

  return {
    summary: {
      totalTickets,
      resolvedTickets: resolvedCount,
      firstResponseSlaPercent: totalTickets > 0 ? Math.round((withinFirstResponseSla / totalTickets) * 100) : 0,
      resolutionSlaPercent: resolvedCount > 0 ? Math.round((withinResolutionSla / resolvedCount) * 100) : 0,
      avgFirstResponseHours,
      avgResolutionHours,
    },
    byPriority: Object.entries(byPriority).map(([priority, data]) => ({
      priority, ...data,
      slaPct: data.resolved > 0 ? Math.round((data.withinSla / data.resolved) * 100) : 0,
    })),
    slaThresholds: { firstResponse: SLA_FIRST_RESPONSE, resolution: SLA_RESOLUTION },
  };
}

export async function getCollectionReport(filters: DateRangeFilter, dataScope: Record<string, unknown>) {
  const scopeWhere = buildScopeWhere(dataScope, 'assignedTo', 'assignedUser');
  const caseWhere: Record<string, unknown> = {
    ...scopeWhere,
    createdAt: {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate + 'T23:59:59.999Z'),
    },
  };

  if (filters.userId) caseWhere.assignedTo = filters.userId;
  if (filters.campaignId) caseWhere.campaignId = filters.campaignId;

  const cases = await prisma.debtCase.findMany({
    where: caseWhere,
    select: {
      id: true, status: true, assignedTo: true,
      outstandingAmount: true, promiseAmount: true,
      assignedUser: { select: { id: true, fullName: true } },
    },
  });

  // Per-agent grouping
  const grouped: Record<string, {
    agentName: string; total: number; contacted: number;
    promiseToPay: number; collected: number;
  }> = {};

  for (const c of cases) {
    const agentId = c.assignedTo || 'unassigned';
    if (!grouped[agentId]) {
      grouped[agentId] = {
        agentName: c.assignedUser?.fullName || 'Chưa phân công',
        total: 0, contacted: 0, promiseToPay: 0, collected: 0,
      };
    }
    grouped[agentId].total++;
    if (c.status !== 'active') {
      grouped[agentId].contacted++;
    }
    if (c.status === 'promise_to_pay') {
      grouped[agentId].promiseToPay++;
    }
    if (c.status === 'paid') {
      grouped[agentId].collected++;
    }
  }

  return Object.values(grouped).map((g) => ({
    agentName: g.agentName,
    totalCases: g.total,
    contacted: g.contacted,
    promiseToPay: g.promiseToPay,
    collected: g.collected,
    collectionRate: g.total > 0 ? g.collected / g.total : 0,
  }));
}
