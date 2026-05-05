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

  const ext = input.sipExtension || null;
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role as never,
      teamId: input.teamId || null,
      sipExtension: ext,
      extension: ext,
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
      // Keep sipExtension (legacy) and extension (cluster-mapped) in sync.
      ...(input.sipExtension !== undefined && {
        sipExtension: input.sipExtension,
        extension: input.sipExtension,
      }),
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

/**
 * Delete a user. Detaches history rows (nullable FKs) and removes personal rows
 * (notifications, status logs, macros). If the user still has NOT NULL business
 * references (tickets or QA annotations), we reject the hard delete and the UI
 * should fall back to deactivation to preserve audit trails.
 */
export async function deleteUser(id: string) {
  await getUserById(id);

  const [ticketCount, qaCount] = await Promise.all([
    prisma.ticket.count({ where: { userId: id } }),
    prisma.qaAnnotation.count({ where: { reviewerId: id } }),
  ]);
  if (ticketCount > 0 || qaCount > 0) {
    throw Object.assign(
      new Error(
        `Tài khoản còn ${ticketCount} ticket và ${qaCount} QA đánh giá. Vui lòng vô hiệu hoá (thay vì xoá) để giữ lịch sử.`,
      ),
      { code: 'USER_HAS_REFERENCES' },
    );
  }

  await prisma.$transaction(async (tx) => {
    // Nullify nullable FKs (preserve history but detach the user)
    await tx.contact.updateMany({ where: { assignedTo: id }, data: { assignedTo: null } });
    await tx.contact.updateMany({ where: { createdBy: id }, data: { createdBy: null } });
    await tx.lead.updateMany({ where: { assignedTo: id }, data: { assignedTo: null } });
    await tx.debtCase.updateMany({ where: { assignedTo: id }, data: { assignedTo: null } });
    await tx.callLog.updateMany({ where: { userId: id }, data: { userId: null } });
    await tx.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
    await tx.team.updateMany({ where: { leaderId: id }, data: { leaderId: null } });

    // Personal rows owned by the user — safe to delete
    await tx.notification.deleteMany({ where: { userId: id } });
    await tx.agentStatusLog.deleteMany({ where: { userId: id } });
    await tx.macro.deleteMany({ where: { createdBy: id } });
    // campaignAgents has onDelete: Cascade in schema — Prisma will cascade on user.delete

    await tx.user.delete({ where: { id } });
  });
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
  const ext = input.extension || null;
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role as never,
      extension: ext,
      sipExtension: ext,
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
    const ext = row.extension || null;
    await prisma.user.create({
      data: {
        email: row.email,
        passwordHash,
        fullName: row.name,
        role: row.role as never,
        extension: ext,
        sipExtension: ext,
        clusterId,
        status: 'active',
        mustChangePassword: true,
      },
    });
    created.push(row.email);
  }
  return { created, skipped };
}
