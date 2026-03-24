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
  const [teams, total] = await Promise.all([
    prisma.team.findMany({
      select: teamSelect,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: pagination.orderBy,
    }),
    prisma.team.count(),
  ]);

  return paginatedResponse(teams, total, pagination.page, pagination.limit);
}

interface CreateTeamInput {
  name: string;
  leaderId?: string | null;
  type: string;
}

export async function createTeam(input: CreateTeamInput) {
  return prisma.team.create({
    data: {
      name: input.name,
      leaderId: input.leaderId || null,
      type: input.type as never,
    },
    select: teamSelect,
  });
}

export async function getTeamById(id: string) {
  const team = await prisma.team.findUnique({ where: { id }, select: teamSelect });
  if (!team) {
    throw Object.assign(new Error('Team not found'), { code: 'NOT_FOUND' });
  }
  return team;
}

export async function updateTeam(id: string, input: Partial<CreateTeamInput> & { isActive?: boolean; leaderId?: string | null }) {
  await getTeamById(id);
  return prisma.team.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.leaderId !== undefined && { leaderId: input.leaderId || null }),
      ...(input.type && { type: input.type as never }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    select: teamSelect,
  });
}

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
