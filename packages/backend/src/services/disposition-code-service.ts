import prisma from '../lib/prisma';
import { logAudit } from '../lib/audit';
import { Request } from 'express';

const dispositionSelect = {
  id: true,
  code: true,
  label: true,
  category: true,
  isFinal: true,
  requiresCallback: true,
  isActive: true,
  sortOrder: true,
};

export async function listDispositionCodes(isActive?: boolean, category?: 'telesale' | 'collection') {
  // When category is passed, include category codes + 'both' (applicable to any campaign type).
  const where: Record<string, unknown> = {};
  if (isActive !== undefined) where.isActive = isActive;
  if (category) where.category = { in: [category, 'both'] };
  return prisma.dispositionCode.findMany({
    where: Object.keys(where).length ? where : undefined,
    select: dispositionSelect,
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });
}

export async function getDispositionCodeById(id: string) {
  const code = await prisma.dispositionCode.findUnique({ where: { id }, select: dispositionSelect });
  if (!code) throw Object.assign(new Error('Disposition code not found'), { code: 'NOT_FOUND' });
  return code;
}

interface CreateDispositionInput {
  code: string;
  label: string;
  category: 'telesale' | 'collection' | 'both';
  isFinal?: boolean;
  requiresCallback?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export async function createDispositionCode(input: CreateDispositionInput, userId: string, req?: Request) {
  const existing = await prisma.dispositionCode.findUnique({ where: { code: input.code } });
  if (existing) {
    throw Object.assign(new Error('Disposition code already exists'), { code: 'CONFLICT' });
  }

  const dc = await prisma.dispositionCode.create({
    data: {
      code: input.code,
      label: input.label,
      category: input.category,
      isFinal: input.isFinal ?? false,
      requiresCallback: input.requiresCallback ?? false,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
    select: dispositionSelect,
  });

  logAudit(userId, 'create', 'disposition_codes', dc.id, { new: input }, req);
  return dc;
}

export async function updateDispositionCode(
  id: string,
  input: Partial<CreateDispositionInput>,
  userId: string,
  req?: Request,
) {
  await getDispositionCodeById(id);

  const dc = await prisma.dispositionCode.update({
    where: { id },
    data: {
      ...(input.label && { label: input.label }),
      ...(input.category && { category: input.category }),
      ...(input.isFinal !== undefined && { isFinal: input.isFinal }),
      ...(input.requiresCallback !== undefined && { requiresCallback: input.requiresCallback }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
    select: dispositionSelect,
  });

  logAudit(userId, 'update', 'disposition_codes', id, { changes: input }, req);
  return dc;
}

export async function deleteDispositionCode(id: string, userId: string, req?: Request) {
  await getDispositionCodeById(id);
  await prisma.dispositionCode.delete({ where: { id } });
  logAudit(userId, 'delete', 'disposition_codes', id, null, req);
}

/** Set disposition on a call log.
 *  `notes` here is NOT written to `call_logs.notes` (that column stores the call-source tag
 *  'c2c'/'autocall'/'callbot'). The optional `notes` argument is only recorded in the audit log
 *  as a free-text reason for the change.
 */
export async function setCallDisposition(
  callLogId: string,
  dispositionCodeId: string,
  notes: string | undefined,
  userId: string,
  req?: Request,
) {
  const callLog = await prisma.callLog.findUnique({
    where: { id: callLogId },
    select: { id: true, dispositionCodeId: true },
  });
  if (!callLog) throw Object.assign(new Error('Call log not found'), { code: 'NOT_FOUND' });

  const dc = await getDispositionCodeById(dispositionCodeId);

  const updated = await prisma.callLog.update({
    where: { id: callLogId },
    data: {
      dispositionCodeId,
      dispositionSetByUserId: userId,
      dispositionSetAt: new Date(),
    },
    select: {
      id: true,
      callUuid: true,
      dispositionCode: { select: { id: true, code: true, label: true } },
      dispositionSetAt: true,
      dispositionSetBy: { select: { id: true, fullName: true } },
    },
  });

  logAudit(
    userId,
    'update',
    'call_logs',
    callLogId,
    {
      field: 'dispositionCodeId',
      previous: callLog.dispositionCodeId,
      next: dispositionCodeId,
      ...(notes ? { reason: notes } : {}),
    },
    req,
  );
  return { ...updated, dispositionCode: dc };
}
