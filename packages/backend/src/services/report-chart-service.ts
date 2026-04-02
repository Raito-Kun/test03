import prisma from '../lib/prisma';
import { buildScopeWhere } from '../middleware/data-scope-middleware';

export interface ChartFilter {
  startDate: string;
  endDate: string;
  userId?: string;
  teamId?: string;
}

function isAnswered(answerTime: Date | null): boolean {
  return answerTime !== null;
}

function isMissed(log: { answerTime: Date | null; hangupCause: string | null; duration: number }): boolean {
  if (log.answerTime) return false;
  const cause = log.hangupCause ?? '';
  return cause === 'NO_ANSWER' || (cause === 'ORIGINATOR_CANCEL' && log.duration < 5);
}

function getISOWeek(date: Date): string {
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${tmp.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** GET /reports/calls/charts */
export async function getCallCharts(
  filters: ChartFilter,
  dataScope: Record<string, unknown>,
) {
  const scopeWhere = buildScopeWhere(dataScope, 'userId', 'user');
  const where: Record<string, unknown> = {
    ...scopeWhere,
    startTime: {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate + 'T23:59:59.999Z'),
    },
  };

  if (filters.userId) where.userId = filters.userId;
  if (filters.teamId) {
    where.user = { ...(where.user as object || {}), teamId: filters.teamId };
  }

  const logs = await prisma.callLog.findMany({
    where,
    select: {
      startTime: true,
      answerTime: true,
      hangupCause: true,
      duration: true,
      user: { select: { fullName: true } },
    },
  });

  // callsByDay
  const byDay: Record<string, { date: string; total: number; answered: number; missed: number }> = {};
  // agentComparison
  const byAgent: Record<string, { agentName: string; answered: number; missed: number }> = {};
  // weeklyTrend
  const byWeek: Record<string, { week: string; total: number; answered: number }> = {};
  // resultDistribution
  const byHangup: Record<string, number> = {};

  for (const log of logs) {
    const date = log.startTime.toISOString().split('T')[0];
    const week = getISOWeek(log.startTime);
    const agentName = log.user?.fullName ?? 'Không xác định';
    const hangupKey = log.hangupCause ?? 'UNKNOWN';
    const answered = isAnswered(log.answerTime);
    const missed = isMissed(log);

    // callsByDay
    if (!byDay[date]) byDay[date] = { date, total: 0, answered: 0, missed: 0 };
    byDay[date].total++;
    if (answered) byDay[date].answered++;
    if (missed) byDay[date].missed++;

    // agentComparison
    if (!byAgent[agentName]) byAgent[agentName] = { agentName, answered: 0, missed: 0 };
    if (answered) byAgent[agentName].answered++;
    if (missed) byAgent[agentName].missed++;

    // weeklyTrend
    if (!byWeek[week]) byWeek[week] = { week, total: 0, answered: 0 };
    byWeek[week].total++;
    if (answered) byWeek[week].answered++;

    // resultDistribution
    byHangup[hangupKey] = (byHangup[hangupKey] ?? 0) + 1;
  }

  return {
    callsByDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    agentComparison: Object.values(byAgent),
    weeklyTrend: Object.values(byWeek).sort((a, b) => a.week.localeCompare(b.week)),
    resultDistribution: Object.entries(byHangup).map(([hangupCause, count]) => ({ hangupCause, count })),
  };
}
