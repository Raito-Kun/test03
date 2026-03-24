import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { logAudit } from '../lib/audit';
import { Request } from 'express';

const macroSelect = {
  id: true,
  name: true,
  content: true,
  category: true,
  shortcut: true,
  isGlobal: true,
  isActive: true,
  createdBy: true,
  creator: { select: { id: true, fullName: true } },
};

interface CreateMacroInput {
  name: string;
  content: string;
  category?: string;
  shortcut?: string;
  isGlobal?: boolean;
  isActive?: boolean;
}

export async function listMacros(pagination: PaginationParams, userId: string, role: string) {
  const isAdmin = ['admin', 'manager'].includes(role);

  const where = isAdmin
    ? {}
    : { OR: [{ isGlobal: true }, { createdBy: userId }] };

  const [macros, total] = await Promise.all([
    prisma.macro.findMany({
      where,
      select: macroSelect,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { name: 'asc' },
    }),
    prisma.macro.count({ where }),
  ]);

  return paginatedResponse(macros, total, pagination.page, pagination.limit);
}

export async function getMacroById(id: string, userId: string, role: string) {
  const isAdmin = ['admin', 'manager'].includes(role);
  const where = isAdmin
    ? { id }
    : { id, OR: [{ isGlobal: true }, { createdBy: userId }] };

  const macro = await prisma.macro.findFirst({ where, select: macroSelect });
  if (!macro) throw Object.assign(new Error('Macro not found'), { code: 'NOT_FOUND' });
  return macro;
}

export async function createMacro(input: CreateMacroInput, userId: string, req?: Request) {
  // Only admins/managers can create global macros
  const macro = await prisma.macro.create({
    data: {
      name: input.name,
      content: input.content,
      category: input.category || null,
      shortcut: input.shortcut || null,
      isGlobal: input.isGlobal ?? false,
      isActive: input.isActive ?? true,
      createdBy: userId,
    },
    select: macroSelect,
  });

  logAudit(userId, 'create', 'macros', macro.id, { new: input }, req);
  return macro;
}

export async function updateMacro(
  id: string,
  input: Partial<CreateMacroInput>,
  userId: string,
  role: string,
  req?: Request,
) {
  await getMacroById(id, userId, role);

  const macro = await prisma.macro.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.content && { content: input.content }),
      ...(input.category !== undefined && { category: input.category || null }),
      ...(input.shortcut !== undefined && { shortcut: input.shortcut || null }),
      ...(input.isGlobal !== undefined && { isGlobal: input.isGlobal }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    select: macroSelect,
  });

  logAudit(userId, 'update', 'macros', id, { changes: input }, req);
  return macro;
}

export async function deleteMacro(id: string, userId: string, role: string, req?: Request) {
  const macro = await getMacroById(id, userId, role);

  // Only owner or admin can delete
  const isAdmin = ['admin', 'manager'].includes(role);
  if (!isAdmin && macro.createdBy !== userId) {
    throw Object.assign(new Error('Cannot delete another user\'s macro'), { code: 'FORBIDDEN' });
  }

  await prisma.macro.delete({ where: { id } });
  logAudit(userId, 'delete', 'macros', id, null, req);
}
