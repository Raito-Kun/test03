import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { getAllAgentStatuses } from './agent-status-service';
import { buildScopeWhere } from '../middleware/data-scope-middleware';

const CACHE_TTL = 30; // 30 seconds
const UTC7_OFFSET_MS = 7 * 60 * 60 * 1000;

function cacheKey(role: string, teamId: string | null, userId?: string): string {
  return `dashboard:overview:${role}:${teamId || 'all'}:${userId || 'all'}`;
}

function agentsCacheKey(role: string, teamId: string | null): string {
  return `dashboard:agents:${role}:${teamId || 'all'}`;
}

/** Midnight UTC+7 for today → UTC Date */
function todayMidnightUTC7(): Date {
  const nowUtc = Date.now();
  const nowUtc7 = nowUtc + UTC7_OFFSET_MS;
  const d = new Date(nowUtc7);
  // Zero out time in UTC+7
  d.setUTCHours(0, 0, 0, 0);
  // Convert back to UTC
  return new Date(d.getTime() - UTC7_OFFSET_MS);
}

/** Count distinct call_uuids matching where clause */
async function countDistinctCalls(where: Record<string, unknown>): Promise<number> {
  const result = await prisma.callLog.groupBy({
    by: ['callUuid'],
    where,
  });
  return result.length;
}

export async function getOverview(
  dataScope: Record<string, unknown>,
  role: string,
  teamId: string | null,
  userId?: string,
) {
  const key = cacheKey(role, teamId, userId);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const scopeWhere = buildScopeWhere(dataScope, 'userId', 'user');
  const dayStart = todayMidnightUTC7();
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const [
    totalCallsToday,
    answeredCallsToday,
    agentCount,
    onCallCount,
    newLeadsToday,
    openTickets,
    activeDebtCases,
  ] = await Promise.all([
    countDistinctCalls({ ...scopeWhere, startTime: { gte: dayStart, lt: dayEnd } }),
    countDistinctCalls({ ...scopeWhere, startTime: { gte: dayStart, lt: dayEnd }, answerTime: { not: null } }),
    prisma.user.count({ where: { status: 'active' } }),
    prisma.agentStatusLog.count({ where: { status: 'on_call', endedAt: null, startedAt: { gte: new Date(Date.now() - 86400000) } } }),
    prisma.lead.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    prisma.debtCase.count({ where: { status: { in: ['active', 'in_progress', 'promise_to_pay'] } } }),
  ]);

  const answerRate = totalCallsToday > 0
    ? Math.round((answeredCallsToday / totalCallsToday) * 100)
    : 0;

  // Additional KPIs
  const [
    totalLeads,
    wonLeads,
    totalDebtCases,
    ptpDebtCases,
    paidDebtCases,
    paidAmountAgg,
    totalOutstandingAgg,
    wrapUpDurationAvg,
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.lead.count({ where: { status: 'won', updatedAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.debtCase.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.debtCase.count({ where: { status: 'promise_to_pay', updatedAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.debtCase.count({ where: { status: 'paid', updatedAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.debtCase.aggregate({
      where: { status: 'paid', updatedAt: { gte: dayStart, lt: dayEnd } },
      _sum: { paidAmount: true },
    }),
    prisma.debtCase.aggregate({
      where: { status: { in: ['active', 'in_progress', 'promise_to_pay'] } },
      _sum: { outstandingAmount: true },
    }),
    // placeholder — avgWrapUpSeconds computed after
    Promise.resolve(null),
  ]);

  const closeRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
  const ptpRate = totalDebtCases > 0 ? Math.round((ptpDebtCases / totalDebtCases) * 100) : 0;
  const recoveryRate = totalDebtCases > 0 ? Math.round((paidDebtCases / totalDebtCases) * 100) : 0;

  void wrapUpDurationAvg; // computed separately below

  // Compute average wrap-up duration using wrapUpDuration field
  let avgWrapUpSeconds = 0;
  try {
    const wrapUpAgg = await prisma.agentStatusLog.aggregate({
      where: {
        status: 'wrap_up',
        startedAt: { gte: dayStart, lt: dayEnd },
        wrapUpDuration: { not: null },
      },
      _avg: { wrapUpDuration: true },
    });
    avgWrapUpSeconds = Math.round(wrapUpAgg._avg.wrapUpDuration || 0);
  } catch {
    // ignore
  }

  const result = {
    calls: {
      totalToday: totalCallsToday,
      answeredToday: answeredCallsToday,
      answerRatePercent: answerRate,
    },
    agents: {
      total: agentCount,
      onCall: onCallCount,
    },
    leads: {
      newToday: newLeadsToday,
      wonToday: wonLeads,
      closeRatePercent: closeRate,
    },
    tickets: { open: openTickets },
    debtCases: {
      active: activeDebtCases,
      ptpToday: ptpDebtCases,
      ptpRatePercent: ptpRate,
      paidToday: paidDebtCases,
      recoveryRatePercent: recoveryRate,
      amountCollectedToday: paidAmountAgg._sum.paidAmount || 0,
      totalOutstanding: totalOutstandingAgg._sum.outstandingAmount || 0,
    },
    wrapUp: { avgDurationSeconds: avgWrapUpSeconds },
    generatedAt: new Date().toISOString(),
  };

  await redis.set(key, JSON.stringify(result), 'EX', CACHE_TTL);
  return result;
}

/**
 * Strict "see only roles below you" visibility rule (user decision 2026-04-21):
 * - super_admin: sees everyone below (admin, manager, qa, leader, all agent variants)
 * - admin: sees manager, qa, leader, all agents (NOT other admins, NOT super_admin)
 * - manager: sees qa, leader, all agents
 * - qa: sees all agents (peer roles manager/leader hidden)
 * - leader: sees agents of their own team only
 * - agent / agent_telesale / agent_collection: sees nothing
 * Peers at the same rank are hidden from each other.
 */
const VISIBLE_ROLES_BELOW: Record<string, string[]> = {
  super_admin: ['admin', 'manager', 'qa', 'leader', 'agent', 'agent_telesale', 'agent_collection'],
  admin: ['manager', 'qa', 'leader', 'agent', 'agent_telesale', 'agent_collection'],
  manager: ['qa', 'leader', 'agent', 'agent_telesale', 'agent_collection'],
  qa: ['agent', 'agent_telesale', 'agent_collection'],
  leader: ['agent', 'agent_telesale', 'agent_collection'],
  agent: [],
  agent_telesale: [],
  agent_collection: [],
};

export async function getAgentsDashboard(role: string, teamId: string | null) {
  const key = agentsCacheKey(role, teamId);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const visibleRoles = VISIBLE_ROLES_BELOW[role] ?? [];
  if (visibleRoles.length === 0) {
    await redis.set(key, JSON.stringify([]), 'EX', CACHE_TTL);
    return [];
  }

  // Leader is scoped to their own team on top of the role filter.
  const whereClause: Record<string, unknown> = {
    status: 'active',
    role: { in: visibleRoles },
  };
  if (role === 'leader' && teamId) whereClause.teamId = teamId;

  const users = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      fullName: true,
      role: true,
      sipExtension: true,
      teamId: true,
      team: { select: { id: true, name: true } },
    },
  });

  const statuses = await getAllAgentStatuses();
  const statusMap = new Map(statuses.map((s) => [s.userId, s]));

  const agents = users.map((u) => ({
    ...u,
    currentStatus: statusMap.get(u.id) || { userId: u.id, status: 'offline', updatedAt: null },
  }));

  await redis.set(key, JSON.stringify(agents), 'EX', CACHE_TTL);
  return agents;
}
