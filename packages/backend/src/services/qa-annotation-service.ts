import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { logAudit } from '../lib/audit';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { Request } from 'express';

const qaSelect = {
  id: true,
  callLogId: true,
  score: true,
  criteriaScores: true,
  comment: true,
  timestampNote: true,
  createdAt: true,
  reviewer: { select: { id: true, fullName: true } },
  callLog: { select: { id: true, callUuid: true, startTime: true } },
};

interface CreateQaInput {
  score: number;
  criteriaScores?: unknown;
  comment?: string;
  timestampNote?: unknown;
}

export async function createQaAnnotation(
  callLogId: string,
  input: CreateQaInput,
  reviewerId: string,
  req?: Request,
) {
  const callLog = await prisma.callLog.findUnique({ where: { id: callLogId } });
  if (!callLog) throw Object.assign(new Error('Call log not found'), { code: 'NOT_FOUND' });

  const qa = await prisma.qaAnnotation.create({
    data: {
      callLogId,
      reviewerId,
      score: input.score,
      criteriaScores: input.criteriaScores ?? undefined,
      comment: input.comment || null,
      timestampNote: input.timestampNote ?? undefined,
    },
    select: qaSelect,
  });

  logAudit(reviewerId, 'create', 'qa_annotations', qa.id, { callLogId, score: input.score }, req);
  return qa;
}

export async function updateQaAnnotation(
  id: string,
  input: Partial<CreateQaInput>,
  reviewerId: string,
  req?: Request,
) {
  const qa = await prisma.qaAnnotation.findUnique({ where: { id } });
  if (!qa) throw Object.assign(new Error('QA annotation not found'), { code: 'NOT_FOUND' });

  // Only the reviewer can edit their own annotation
  if (qa.reviewerId !== reviewerId) {
    throw Object.assign(new Error('Cannot edit another reviewer\'s annotation'), { code: 'FORBIDDEN' });
  }

  const updateData: Prisma.QaAnnotationUpdateInput = {};
  if (input.score !== undefined) updateData.score = input.score;
  if (input.criteriaScores !== undefined) {
    updateData.criteriaScores = input.criteriaScores === null
      ? Prisma.JsonNull
      : (input.criteriaScores as Prisma.InputJsonValue);
  }
  if (input.comment !== undefined) updateData.comment = input.comment || null;
  if (input.timestampNote !== undefined) {
    updateData.timestampNote = input.timestampNote === null
      ? Prisma.JsonNull
      : (input.timestampNote as Prisma.InputJsonValue);
  }

  const updated = await prisma.qaAnnotation.update({
    where: { id },
    data: updateData,
    select: qaSelect,
  });

  logAudit(reviewerId, 'update', 'qa_annotations', id, { changes: input }, req);
  return updated;
}

export interface ListQaFilter {
  callLogId?: string;
  reviewerId?: string;
  startDate?: string;
  endDate?: string;
}

export async function listQaAnnotations(pagination: PaginationParams, filters: ListQaFilter) {
  const where: Record<string, unknown> = {};

  if (filters.callLogId) where.callLogId = filters.callLogId;
  if (filters.reviewerId) where.reviewerId = filters.reviewerId;

  if (filters.startDate || filters.endDate) {
    where.createdAt = {
      ...(filters.startDate && { gte: new Date(filters.startDate) }),
      ...(filters.endDate && { lte: new Date(filters.endDate) }),
    };
  }

  const [annotations, total] = await Promise.all([
    prisma.qaAnnotation.findMany({
      where,
      select: qaSelect,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.qaAnnotation.count({ where }),
  ]);

  return paginatedResponse(annotations, total, pagination.page, pagination.limit);
}
