import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { buildScopeWhere } from '../middleware/data-scope-middleware';

const callLogSelect = {
  id: true,
  callUuid: true,
  direction: true,
  callerNumber: true,
  destinationNumber: true,
  startTime: true,
  answerTime: true,
  endTime: true,
  duration: true,
  billsec: true,
  hangupCause: true,
  recordingStatus: true,
  notes: true,
  createdAt: true,
  contact: { select: { id: true, fullName: true, phone: true } },
  user: { select: { id: true, fullName: true } },
  dispositionCode: { select: { id: true, code: true, label: true } },
};

export interface ListCallLogsFilter {
  startDate?: string;
  endDate?: string;
  userId?: string;
  direction?: string;
  disposition?: string;
  campaignId?: string;
}

export async function listCallLogs(
  pagination: PaginationParams,
  filters: ListCallLogsFilter,
  dataScope: Record<string, unknown>,
) {
  const scopeWhere = buildScopeWhere(dataScope, 'userId', 'user');
  const where: Record<string, unknown> = { ...scopeWhere };

  if (filters.userId) where.userId = filters.userId;
  if (filters.direction) where.direction = filters.direction;
  if (filters.disposition) where.dispositionCodeId = filters.disposition;
  if (filters.campaignId) where.campaignId = filters.campaignId;

  if (filters.startDate || filters.endDate) {
    where.startTime = {
      ...(filters.startDate && { gte: new Date(filters.startDate) }),
      ...(filters.endDate && { lte: new Date(filters.endDate) }),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.callLog.findMany({
      where,
      select: callLogSelect,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: pagination.orderBy,
    }),
    prisma.callLog.count({ where }),
  ]);

  return paginatedResponse(logs, total, pagination.page, pagination.limit);
}

export async function getCallLogById(id: string, dataScope: Record<string, unknown>) {
  const scopeWhere = buildScopeWhere(dataScope, 'userId', 'user');
  const log = await prisma.callLog.findFirst({
    where: { id, ...scopeWhere },
    select: {
      ...callLogSelect,
      aiTranscript: true,
      aiSummary: true,
      aiScore: true,
      campaign: { select: { id: true, name: true } },
      qaAnnotations: {
        select: {
          id: true,
          score: true,
          criteriaScores: true,
          comment: true,
          createdAt: true,
          reviewer: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!log) {
    throw Object.assign(new Error('Call log not found'), { code: 'NOT_FOUND' });
  }
  return log;
}
