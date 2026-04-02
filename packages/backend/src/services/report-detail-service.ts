import prisma from '../lib/prisma';
import { buildScopeWhere } from '../middleware/data-scope-middleware';

export interface DetailFilter {
  startDate: string;
  endDate: string;
  userId?: string;
  teamId?: string;
  hangupCause?: string;
  sipCode?: number;
  page: number;
  limit: number;
}

/** GET /reports/calls/detail — paginated call log rows */
export async function getCallDetail(
  filters: DetailFilter,
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
  if (filters.hangupCause) where.hangupCause = filters.hangupCause;
  if (filters.sipCode !== undefined) where.sipCode = filters.sipCode;
  if (filters.teamId) {
    where.user = { ...(where.user as object || {}), teamId: filters.teamId };
  }

  const skip = (filters.page - 1) * filters.limit;

  const [total, rows] = await Promise.all([
    prisma.callLog.count({ where }),
    prisma.callLog.findMany({
      where,
      skip,
      take: filters.limit,
      orderBy: { startTime: 'desc' },
      select: {
        id: true,
        startTime: true,
        callerNumber: true,
        destinationNumber: true,
        duration: true,
        billsec: true,
        hangupCause: true,
        sipCode: true,
        recordingPath: true,
        recordingStatus: true,
        user: { select: { fullName: true } },
      },
    }),
  ]);

  const data = rows.map((r) => ({
    id: r.id,
    startTime: r.startTime,
    agentName: r.user?.fullName ?? 'Không xác định',
    callerNumber: r.callerNumber,
    destinationNumber: r.destinationNumber,
    duration: r.duration,
    billsec: r.billsec,
    hangupCause: r.hangupCause,
    sipCode: r.sipCode,
    recordingPath: r.recordingPath,
    recordingStatus: r.recordingStatus,
  }));

  return {
    data,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}
