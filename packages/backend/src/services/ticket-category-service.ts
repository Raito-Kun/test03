import prisma from '../lib/prisma';
import { logAudit } from '../lib/audit';
import { Request } from 'express';

const categorySelect = {
  id: true,
  name: true,
  parentId: true,
  isActive: true,
  sortOrder: true,
  children: { select: { id: true, name: true, isActive: true, sortOrder: true } },
};

export async function listCategories(isActive?: boolean) {
  return prisma.ticketCategory.findMany({
    where: {
      parentId: null, // top level only; children included via select
      ...(isActive !== undefined && { isActive }),
    },
    select: categorySelect,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function getCategoryById(id: string) {
  const cat = await prisma.ticketCategory.findUnique({ where: { id }, select: categorySelect });
  if (!cat) throw Object.assign(new Error('Category not found'), { code: 'NOT_FOUND' });
  return cat;
}

interface CreateCategoryInput {
  name: string;
  parentId?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export async function createCategory(input: CreateCategoryInput, userId: string, req?: Request) {
  const cat = await prisma.ticketCategory.create({
    data: {
      name: input.name,
      parentId: input.parentId || null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
    select: categorySelect,
  });

  logAudit(userId, 'create', 'ticket_categories', cat.id, { new: input }, req);
  return cat;
}

export async function updateCategory(
  id: string,
  input: Partial<CreateCategoryInput>,
  userId: string,
  req?: Request,
) {
  await getCategoryById(id);

  const cat = await prisma.ticketCategory.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.parentId !== undefined && { parentId: input.parentId || null }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
    select: categorySelect,
  });

  logAudit(userId, 'update', 'ticket_categories', id, { changes: input }, req);
  return cat;
}

export async function deleteCategory(id: string, userId: string, req?: Request) {
  await getCategoryById(id);
  await prisma.ticketCategory.delete({ where: { id } });
  logAudit(userId, 'delete', 'ticket_categories', id, null, req);
}
