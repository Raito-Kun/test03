import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { getAllAgentStatuses } from './agent-status-service';
import { buildScopeWhere } from '../middleware/data-scope-middleware';

const CACHE_TTL = 30; // 30 seconds

function cacheKey(role: string, teamId: string | null): string {
  return `dashboard:overview:${role}:${teamId || 'all'}`;
}

function agentsCacheKey(role: string, teamId: string | null): string {
  return `dashboard:agents:${role}:${teamId || 'all'}`;
}

export async function getOverview(dataScope: Record<string, unknown>, role: string, teamId: string | null) {
  const key = cacheKey(role, teamId);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const scopeWhere = buildScopeWhere(dataScope, 'userId', 'user');
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
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
    prisma.callLog.count({
      where: { ...scopeWhere, startTime: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.callLog.count({
      where: { ...scopeWhere, startTime: { gte: dayStart, lt: dayEnd }, answerTime: { not: null } },
    }),
    prisma.user.count({ where: { status: 'active' } }),
    // On-call count from agent status logs (approximate)
    prisma.agentStatusLog.count({ where: { status: 'on_call', endedAt: null } }),
    prisma.lead.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    prisma.debtCase.count({ where: { status: { in: ['active', 'in_progress', 'promise_to_pay'] } } }),
  ]);

  const answerRate = totalCallsToday > 0
    ? Math.round((answeredCallsToday / totalCallsToday) * 100)
    : 0;

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
    leads: { newToday: newLeadsToday },
    tickets: { open: openTickets },
    debtCases: { active: activeDebtCases },
    generatedAt: new Date().toISOString(),
  };

  await redis.set(key, JSON.stringify(result), 'EX', CACHE_TTL);
  return result;
}

export async function getAgentsDashboard(role: string, teamId: string | null) {
  const key = agentsCacheKey(role, teamId);
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const whereClause = teamId && role === 'leader' ? { teamId } : {};

  const users = await prisma.user.findMany({
    where: { status: 'active', ...whereClause },
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
