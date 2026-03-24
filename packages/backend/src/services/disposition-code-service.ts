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

export async function listDispositionCodes(isActive?: boolean) {
  return prisma.dispositionCode.findMany({
    where: isActive !== undefined ? { isActive } : undefined,
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

/** Set disposition on a call log */
export async function setCallDisposition(
  callLogId: string,
  dispositionCodeId: string,
  notes: string | undefined,
  userId: string,
  req?: Request,
) {
  const callLog = await prisma.callLog.findUnique({ where: { id: callLogId } });
  if (!callLog) throw Object.assign(new Error('Call log not found'), { code: 'NOT_FOUND' });

  const dc = await getDispositionCodeById(dispositionCodeId);

  const updated = await prisma.callLog.update({
    where: { id: callLogId },
    data: {
      dispositionCodeId,
      ...(notes !== undefined && { notes }),
    },
    select: {
      id: true,
      callUuid: true,
      dispositionCode: { select: { id: true, code: true, label: true } },
      notes: true,
    },
  });

  logAudit(userId, 'update', 'call_logs', callLogId, { dispositionCodeId, notes }, req);
  return { ...updated, dispositionCode: dc };
}
