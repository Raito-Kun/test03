import prisma from '../lib/prisma';
import { buildScopeWhere } from '../middleware/data-scope-middleware';

export interface TicketSummaryFilter {
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

export interface TicketAgentRow {
  agentId: string;
  agentName: string;
  teamName: string;
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  slaBreached: number;
  avgResolutionHours: number;
}

/** GET /reports/tickets/summary — tickets grouped by creator (agent) */
export async function getTicketSummaryByAgent(
  filters: TicketSummaryFilter,
  dataScope: Record<string, unknown>,
): Promise<TicketAgentRow[]> {
  const scopeWhere = buildScopeWhere(dataScope, 'userId', 'user');
  const where: Record<string, unknown> = {
    ...scopeWhere,
    createdAt: buildDateWhere(filters.startDate, filters.endDate),
  };

  if (filters.userId) where.userId = filters.userId;
  if (filters.teamId) {
    where.user = { ...(where.user as object || {}), teamId: filters.teamId };
  }

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      userId: true,
      status: true,
      slaBreached: true,
      createdAt: true,
      resolvedAt: true,
      user: { select: { id: true, fullName: true, team: { select: { name: true } } } },
    },
  });

  const groups = new Map<string, TicketAgentRow & { resolutionMsSum: number; resolvedCount: number }>();
  for (const t of tickets) {
    const key = t.userId;
    let row = groups.get(key);
    if (!row) {
      row = {
        agentId: t.userId,
        agentName: t.user?.fullName ?? '—',
        teamName: t.user?.team?.name ?? '—',
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
        slaBreached: 0,
        avgResolutionHours: 0,
        resolutionMsSum: 0,
        resolvedCount: 0,
      };
      groups.set(key, row);
    }
    row.total += 1;
    if (t.status === 'open') row.open += 1;
    else if (t.status === 'in_progress') row.inProgress += 1;
    else if (t.status === 'resolved') row.resolved += 1;
    else if (t.status === 'closed') row.closed += 1;
    if (t.slaBreached) row.slaBreached += 1;
    if (t.resolvedAt) {
      row.resolutionMsSum += t.resolvedAt.getTime() - t.createdAt.getTime();
      row.resolvedCount += 1;
    }
  }

  return Array.from(groups.values()).map((r) => ({
    agentId: r.agentId,
    agentName: r.agentName,
    teamName: r.teamName,
    total: r.total,
    open: r.open,
    inProgress: r.inProgress,
    resolved: r.resolved,
    closed: r.closed,
    slaBreached: r.slaBreached,
    avgResolutionHours: r.resolvedCount > 0
      ? Math.round((r.resolutionMsSum / r.resolvedCount / 3_600_000) * 10) / 10
      : 0,
  })).sort((a, b) => b.total - a.total);
}
