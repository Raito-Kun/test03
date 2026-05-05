import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';

const teamSelect = {
  id: true,
  name: true,
  leaderId: true,
  type: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  leader: { select: { id: true, fullName: true, email: true } },
  _count: { select: { members: true } },
};

export async function listTeams(pagination: PaginationParams) {
  const where = { isActive: true };
  const [teams, total] = await Promise.all([
    prisma.team.findMany({
      where,
      select: teamSelect,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: pagination.orderBy,
    }),
    prisma.team.count({ where }),
  ]);

  return paginatedResponse(teams, total, pagination.page, pagination.limit);
}

interface CreateTeamInput {
  name: string;
  leaderId?: string | null;
  type: string;
  memberIds?: string[];
}

export async function createTeam(input: CreateTeamInput) {
  const team = await prisma.team.create({
    data: {
      name: input.name,
      leaderId: input.leaderId || null,
      type: input.type as never,
    },
    select: teamSelect,
  });

  // Assign members if provided
  if (input.memberIds?.length) {
    await prisma.user.updateMany({
      where: { id: { in: input.memberIds } },
      data: { teamId: team.id },
    });
    // Re-fetch to get updated member count
    return prisma.team.findUnique({ where: { id: team.id }, select: teamSelect });
  }

  return team;
}

export async function getTeamById(id: string) {
  const team = await prisma.team.findUnique({ where: { id }, select: teamSelect });
  if (!team) {
    throw Object.assign(new Error('Team not found'), { code: 'NOT_FOUND' });
  }
  return team;
}

export async function updateTeam(id: string, input: Partial<CreateTeamInput> & { isActive?: boolean; leaderId?: string | null; memberIds?: string[] }) {
  await getTeamById(id);
  const team = await prisma.team.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.leaderId !== undefined && { leaderId: input.leaderId || null }),
      ...(input.type && { type: input.type as never }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    select: teamSelect,
  });

  // Replace members if provided
  if (input.memberIds !== undefined) {
    // Remove all current members
    await prisma.user.updateMany({ where: { teamId: id }, data: { teamId: null } });
    // Assign new members
    if (input.memberIds.length > 0) {
      await prisma.user.updateMany({ where: { id: { in: input.memberIds } }, data: { teamId: id } });
    }
    return prisma.team.findUnique({ where: { id }, select: teamSelect });
  }

  return team;
}

export async function deleteTeam(id: string) {
  const team = await getTeamById(id);
  const memberCount = team._count?.members ?? 0;

  if (memberCount > 0) {
    throw Object.assign(
      new Error(`Không thể xóa team đang có ${memberCount} thành viên. Vui lòng chuyển thành viên sang team khác trước.`),
      { code: 'HAS_MEMBERS' },
    );
  }

  await prisma.team.delete({ where: { id } });
}

// Keep for backward compat
export async function deactivateTeam(id: string) {
  await getTeamById(id);
  return prisma.team.update({
    where: { id },
    data: { isActive: false },
    select: teamSelect,
  });
}

export async function getTeamMembers(teamId: string) {
  await getTeamById(teamId);
  return prisma.user.findMany({
    where: { teamId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      sipExtension: true,
      status: true,
    },
  });
}
