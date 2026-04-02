import prisma from '../lib/prisma';
import { buildScopeWhere } from '../middleware/data-scope-middleware';

export interface SummaryFilter {
  startDate: string;
  endDate: string;
  userId?: string;
  teamId?: string;
}

function buildDateWhere(startDate: string, endDate: string) {
  return {
    gte: new Date(startDate),
    lte: new Date(endDate + 'T23:59:59.999Z'),
  };
}

function classifyCall(log: { answerTime: Date | null; hangupCause: string | null; duration: number }) {
  if (log.answerTime) return 'answered';
  const cause = log.hangupCause ?? '';
  if (
    cause === 'ORIGINATOR_CANCEL' ||
    (cause === 'NORMAL_CLEARING' && log.duration === 0)
  ) return 'cancelled';
  return 'missed';
}

/** GET /reports/calls/summary — group by agent */
export async function getCallSummaryByAgent(
  filters: SummaryFilter,
  dataScope: Record<string, unknown>,
) {
  const scopeWhere = buildScopeWhere(dataScope, 'userId', 'user');
  const where: Record<string, unknown> = {
    ...scopeWhere,
    startTime: buildDateWhere(filters.startDate, filters.endDate),
  };

  if (filters.userId) where.userId = filters.userId;
  if (filters.teamId) {
    where.user = { ...(where.user as object || {}), teamId: filters.teamId };
  }

  const logs = await prisma.callLog.findMany({
    where,
    select: {
      userId: true,
      answerTime: true,
      hangupCause: true,
      duration: true,
      billsec: true,
      user: { select: { id: true, fullName: true, team: { select: { name: true } } } },
    },
  });

  type AgentRow = {
    agentId: string;
    agentName: string;
    teamName: string;
    totalCalls: number;
    answered: number;
    missed: number;
    cancelled: number;
    totalDuration: number;
    totalBillsec: number;
  };

  const grouped: Record<string, AgentRow> = {};

  for (const log of logs) {
    const agentId = log.userId ?? 'unknown';
    if (!grouped[agentId]) {
      grouped[agentId] = {
        agentId,
        agentName: log.user?.fullName ?? 'Không xác định',
        teamName: log.user?.team?.name ?? '',
        totalCalls: 0,
        answered: 0,
        missed: 0,
        cancelled: 0,
        totalDuration: 0,
        totalBillsec: 0,
      };
    }
    const row = grouped[agentId];
    row.totalCalls++;
    row.totalDuration += log.duration;
    const kind = classifyCall(log);
    if (kind === 'answered') {
      row.answered++;
      row.totalBillsec += log.billsec;
    } else if (kind === 'cancelled') {
      row.cancelled++;
    } else {
      row.missed++;
    }
  }

  return Object.values(grouped).map((r) => ({
    agentId: r.agentId,
    agentName: r.agentName,
    teamName: r.teamName,
    totalCalls: r.totalCalls,
    answered: r.answered,
    missed: r.missed,
    cancelled: r.cancelled,
    avgDuration: r.totalCalls > 0 ? Math.round(r.totalDuration / r.totalCalls) : 0,
    avgBillsec: r.answered > 0 ? Math.round(r.totalBillsec / r.answered) : 0,
    answerRate: r.totalCalls > 0 ? Math.round((r.answered / r.totalCalls) * 10000) / 10000 : 0,
  }));
}

/** GET /reports/calls/summary-by-team */
export async function getCallSummaryByTeam(
  filters: SummaryFilter,
  dataScope: Record<string, unknown>,
) {
  const scopeWhere = buildScopeWhere(dataScope, 'userId', 'user');
  const where: Record<string, unknown> = {
    ...scopeWhere,
    startTime: buildDateWhere(filters.startDate, filters.endDate),
  };

  if (filters.teamId) {
    where.user = { ...(where.user as object || {}), teamId: filters.teamId };
  }

  const logs = await prisma.callLog.findMany({
    where,
    select: {
      userId: true,
      answerTime: true,
      hangupCause: true,
      duration: true,
      user: { select: { id: true, teamId: true, team: { select: { id: true, name: true } } } },
    },
  });

  type TeamRow = {
    teamId: string;
    teamName: string;
    agentIds: Set<string>;
    totalCalls: number;
    answered: number;
    missed: number;
  };

  const grouped: Record<string, TeamRow> = {};

  for (const log of logs) {
    const teamId = log.user?.team?.id ?? 'no_team';
    const teamName = log.user?.team?.name ?? 'Không có nhóm';
    if (!grouped[teamId]) {
      grouped[teamId] = { teamId, teamName, agentIds: new Set(), totalCalls: 0, answered: 0, missed: 0 };
    }
    const row = grouped[teamId];
    if (log.userId) row.agentIds.add(log.userId);
    row.totalCalls++;
    const kind = classifyCall(log);
    if (kind === 'answered') row.answered++;
    else if (kind === 'missed') row.missed++;
  }

  return Object.values(grouped).map((r) => ({
    teamId: r.teamId,
    teamName: r.teamName,
    agentCount: r.agentIds.size,
    totalCalls: r.totalCalls,
    answered: r.answered,
    missed: r.missed,
    answerRate: r.totalCalls > 0 ? Math.round((r.answered / r.totalCalls) * 10000) / 10000 : 0,
  }));
}
