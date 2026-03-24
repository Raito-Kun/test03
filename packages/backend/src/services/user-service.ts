import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';

const BCRYPT_ROUNDS = 12;

// Fields to return (never include passwordHash)
const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  teamId: true,
  sipExtension: true,
  callMode: true,
  status: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
  team: { select: { id: true, name: true } },
};

interface ListUsersFilter {
  role?: string;
  teamId?: string;
  status?: string;
  search?: string;
}

export async function listUsers(pagination: PaginationParams, filters: ListUsersFilter) {
  const where: Record<string, unknown> = {};

  if (filters.role) where.role = filters.role;
  if (filters.teamId) where.teamId = filters.teamId;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: pagination.orderBy,
    }),
    prisma.user.count({ where }),
  ]);

  return paginatedResponse(users, total, pagination.page, pagination.limit);
}

interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  role: string;
  teamId?: string;
  sipExtension?: string;
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw Object.assign(new Error('Email already in use'), { code: 'EMAIL_EXISTS' });
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role as never,
      teamId: input.teamId || null,
      sipExtension: input.sipExtension || null,
    },
    select: userSelect,
  });

  return user;
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) {
    throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
  }
  return user;
}

interface UpdateUserInput {
  fullName?: string;
  role?: string;
  teamId?: string | null;
  sipExtension?: string | null;
  status?: string;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  await getUserById(id); // throws if not found

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.fullName && { fullName: input.fullName }),
      ...(input.role && { role: input.role as never }),
      ...(input.teamId !== undefined && { teamId: input.teamId }),
      ...(input.sipExtension !== undefined && { sipExtension: input.sipExtension }),
      ...(input.status && { status: input.status as never }),
    },
    select: userSelect,
  });

  return user;
}

export async function deactivateUser(id: string) {
  await getUserById(id);
  const user = await prisma.user.update({
    where: { id },
    data: { status: 'inactive' },
    select: userSelect,
  });
  return user;
}
