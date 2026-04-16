import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { getActiveClusterId, resolveListClusterFilter } from '../lib/active-cluster';

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

export async function listUsers(pagination: PaginationParams, filters: ListUsersFilter, userClusterId?: string | null, userRole?: string) {
  const clusterId = await resolveListClusterFilter(userRole, userClusterId);
  const where: Record<string, unknown> = { ...(clusterId && { clusterId }) };

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

export async function createUser(input: CreateUserInput, userClusterId?: string | null) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw Object.assign(new Error('Email already in use'), { code: 'EMAIL_EXISTS' });
  }

  const clusterId = await getActiveClusterId(userClusterId);
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role as never,
      teamId: input.teamId || null,
      sipExtension: input.sipExtension || null,
      ...(clusterId && { clusterId }),
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
  email?: string;
  fullName?: string;
  role?: string;
  teamId?: string | null;
  sipExtension?: string | null;
  status?: string;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  await getUserById(id); // throws if not found

  // Guard against duplicate email: only check when email is being changed
  // and differs from what's already on the user (avoid self-collision).
  if (input.email) {
    const collision = await prisma.user.findFirst({
      where: { email: input.email, NOT: { id } },
      select: { id: true },
    });
    if (collision) {
      const err = new Error('Email đã được sử dụng') as Error & { code?: string };
      err.code = 'EMAIL_TAKEN';
      throw err;
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.email && { email: input.email }),
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

export async function deleteUser(id: string) {
  await getUserById(id);
  await prisma.user.delete({ where: { id } });
}

export async function changeUserPassword(id: string, newPassword: string) {
  await getUserById(id);
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const user = await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true },
    select: userSelect,
  });
  return user;
}

export async function listClusterUsers(clusterId: string, callerRole?: string) {
  const where: Record<string, unknown> = { clusterId };
  // Non-super_admin should not see super_admin accounts
  if (callerRole && callerRole !== 'super_admin') {
    where.role = { not: 'super_admin' };
  }
  return prisma.user.findMany({
    where,
    select: {
      ...userSelect,
      extension: true,
      clusterId: true,
    },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
  });
}

interface CreateClusterUserInput {
  email: string;
  password: string;
  fullName: string;
  role: string;
  extension?: string | null;
  clusterId: string;
}

export async function createClusterUser(input: CreateClusterUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Object.assign(new Error('Email đã tồn tại'), { code: 'EMAIL_EXISTS' });

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role as never,
      extension: input.extension || null,
      clusterId: input.clusterId,
      status: 'active',
    },
    select: { ...userSelect, extension: true, clusterId: true },
  });
  return user;
}

export async function importClusterUsersFromCsv(
  rows: { name: string; email: string; role: string; extension?: string }[],
  clusterId: string,
) {
  const defaultPassword = 'Pls@1234!';
  const passwordHash = await bcrypt.hash(defaultPassword, BCRYPT_ROUNDS);
  const created: string[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const existing = await prisma.user.findUnique({ where: { email: row.email } });
    if (existing) { skipped.push(row.email); continue; }
    await prisma.user.create({
      data: {
        email: row.email,
        passwordHash,
        fullName: row.name,
        role: row.role as never,
        extension: row.extension || null,
        clusterId,
        status: 'active',
        mustChangePassword: true,
      },
    });
    created.push(row.email);
  }
  return { created, skipped };
}
