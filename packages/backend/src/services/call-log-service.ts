import fs from 'fs/promises';
import path from 'path';
import type { Request } from 'express';
import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { buildScopeWhere } from '../middleware/data-scope-middleware';
import { resolveListClusterFilter } from '../lib/active-cluster';
import { logAudit } from '../lib/audit';

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
  sipCode: true,
  sipReason: true,
  recordingStatus: true,
  notes: true,
  createdAt: true,
  dispositionSetAt: true,
  contact: { select: { id: true, fullName: true, phone: true } },
  user: { select: { id: true, fullName: true } },
  dispositionCode: { select: { id: true, code: true, label: true } },
  dispositionSetBy: { select: { id: true, fullName: true } },
};

export interface ListCallLogsFilter {
  startDate?: string;
  endDate?: string;
  userId?: string;
  direction?: string;
  disposition?: string;
  campaignId?: string;
  search?: string;
  hangupCause?: string;
  sipCode?: string;
  callType?: 'c2c' | 'autocall' | 'manual' | 'callbot';
}

export async function listCallLogs(
  pagination: PaginationParams,
  filters: ListCallLogsFilter,
  dataScope: Record<string, unknown>,
  userClusterId?: string | null,
  userRole?: string,
) {
  const clusterId = await resolveListClusterFilter(userRole, userClusterId);
  const scopeWhere = buildScopeWhere(dataScope, 'userId', 'user');
  const where: Record<string, unknown> = { ...scopeWhere, ...(clusterId && { clusterId }) };

  if (filters.userId) where.userId = filters.userId;
  if (filters.direction) where.direction = filters.direction;
  if (filters.disposition) where.dispositionCodeId = filters.disposition;
  if (filters.campaignId) where.campaignId = filters.campaignId;
  if (filters.hangupCause) where.hangupCause = filters.hangupCause;
  if (filters.sipCode) where.sipCode = { contains: filters.sipCode };

  // Compose AND-conditions so multiple OR-style filters don't clobber each other.
  const andConditions: Record<string, unknown>[] = [];
  if (filters.search) {
    andConditions.push({
      OR: [
        { callerNumber: { contains: filters.search } },
        { destinationNumber: { contains: filters.search } },
      ],
    });
  }
  // Call type stored in `notes` ('c2c' | 'autocall' | 'callbot'); anything else = manual
  if (filters.callType === 'c2c') where.notes = 'c2c';
  else if (filters.callType === 'autocall') where.notes = 'autocall';
  else if (filters.callType === 'callbot') where.notes = 'callbot';
  else if (filters.callType === 'manual') {
    andConditions.push({ OR: [{ notes: null }, { notes: { notIn: ['c2c', 'autocall', 'callbot'] } }] });
  }
  if (andConditions.length) where.AND = andConditions;

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

/**
 * Delete the recording file for a call log and clear the recordingPath field.
 * Scoped by actor's cluster unless super_admin (cross-tenant protection).
 * Path-escape guarded: resolved path must remain inside RECORDINGS_DIR.
 */
export async function deleteRecording(
  callLogId: string,
  userId: string,
  actorClusterId: string | null,
  actorRole: string,
  req?: Request,
) {
  const scope = actorRole === 'super_admin' ? {} : { clusterId: actorClusterId ?? '__none__' };
  const log = await prisma.callLog.findFirst({
    where: { id: callLogId, ...scope },
    select: { id: true, callUuid: true, recordingPath: true, clusterId: true },
  });

  if (!log) {
    throw Object.assign(new Error('Call log not found'), { code: 'NOT_FOUND' });
  }

  const originalRecordingPath = log.recordingPath;

  if (originalRecordingPath) {
    const recordingsRoot = path.resolve(process.env.RECORDINGS_DIR || '/var/lib/freeswitch/recordings');
    const candidate = path.isAbsolute(originalRecordingPath)
      ? originalRecordingPath
      : path.join(recordingsRoot, originalRecordingPath);
    const resolved = path.resolve(candidate);

    // Guard: the resolved path must live under recordingsRoot. Rejects `..` traversal
    // and poisoned absolute paths (e.g. /etc/passwd) written by anything other than FS.
    if (resolved !== recordingsRoot && !resolved.startsWith(recordingsRoot + path.sep)) {
      throw Object.assign(new Error('Recording path escapes recordings directory'), {
        code: 'PATH_ESCAPE',
      });
    }

    try {
      await fs.unlink(resolved);
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== 'ENOENT') throw err;
    }
  }

  const updated = await prisma.callLog.update({
    where: { id: callLogId },
    data: { recordingPath: null, recordingStatus: 'none' },
    select: { id: true, callUuid: true, recordingPath: true, recordingStatus: true },
  });

  logAudit(
    userId,
    'delete',
    'call_log_recording',
    callLogId,
    { callUuid: log.callUuid, recordingPath: originalRecordingPath },
    req,
  );

  return updated;
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
      campaign: { select: { id: true, name: true, type: true } },
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
