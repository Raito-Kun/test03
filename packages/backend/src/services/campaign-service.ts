import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { logAudit } from '../lib/audit';
import { Request } from 'express';
import { getActiveClusterId, resolveListClusterFilter } from '../lib/active-cluster';

const campaignSelect = {
  id: true,
  name: true,
  type: true,
  status: true,
  startDate: true,
  endDate: true,
  script: true,
  category: true,
  queue: true,
  dialMode: true,
  callbackUrl: true,
  workSchedule: true,
  workStartTime: true,
  workEndTime: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { leads: true, debtCases: true, callLogs: true } },
};

const campaignDetailSelect = {
  ...campaignSelect,
  agents: {
    select: {
      assignedAt: true,
      user: {
        select: { id: true, fullName: true, email: true, role: true, sipExtension: true },
      },
    },
  },
};

interface ListCampaignsFilter {
  type?: string;
  status?: string;
}

export async function listCampaigns(pagination: PaginationParams, filters: ListCampaignsFilter, userClusterId?: string | null, userRole?: string) {
  const clusterId = await resolveListClusterFilter(userRole, userClusterId);
  const where: Record<string, unknown> = { ...(clusterId && { clusterId }) };
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      select: campaignSelect,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: pagination.orderBy,
    }),
    prisma.campaign.count({ where }),
  ]);

  return paginatedResponse(campaigns, total, pagination.page, pagination.limit);
}

export async function findById(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: campaignDetailSelect,
  });
  if (!campaign) throw Object.assign(new Error('Campaign not found'), { code: 'NOT_FOUND' });
  return campaign;
}

interface CreateCampaignInput {
  name: string;
  type: string;
  startDate?: string;
  endDate?: string;
  script?: string;
  category?: string;
  queue?: string;
  dialMode?: string;
  callbackUrl?: string;
  workSchedule?: string;
  workStartTime?: string;
  workEndTime?: string;
}

export async function createCampaign(input: CreateCampaignInput, userId: string, req?: Request, userClusterId?: string | null) {
  const clusterId = await getActiveClusterId(userClusterId);

  const campaign = await prisma.campaign.create({
    data: {
      name: input.name,
      type: input.type as never,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      script: input.script || null,
      category: (input.category as never) || null,
      queue: input.queue || null,
      dialMode: (input.dialMode as never) || null,
      callbackUrl: input.callbackUrl || null,
      workSchedule: (input.workSchedule as never) || null,
      workStartTime: input.workStartTime || null,
      workEndTime: input.workEndTime || null,
      createdBy: userId,
      ...(clusterId && { clusterId }),
    },
    select: campaignSelect,
  });

  logAudit(userId, 'create', 'campaigns', campaign.id, { new: input }, req);
  return campaign;
}

export async function updateCampaign(
  id: string,
  input: Partial<CreateCampaignInput> & { status?: string },
  userId: string,
  req?: Request,
) {
  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Campaign not found'), { code: 'NOT_FOUND' });

  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.type && { type: input.type as never }),
      ...(input.status && { status: input.status as never }),
      ...(input.startDate !== undefined && { startDate: input.startDate ? new Date(input.startDate) : null }),
      ...(input.endDate !== undefined && { endDate: input.endDate ? new Date(input.endDate) : null }),
      ...(input.script !== undefined && { script: input.script || null }),
      ...(input.category !== undefined && { category: (input.category as never) || null }),
      ...(input.queue !== undefined && { queue: input.queue || null }),
      ...(input.dialMode !== undefined && { dialMode: (input.dialMode as never) || null }),
      ...(input.callbackUrl !== undefined && { callbackUrl: input.callbackUrl || null }),
      ...(input.workSchedule !== undefined && { workSchedule: (input.workSchedule as never) || null }),
      ...(input.workStartTime !== undefined && { workStartTime: input.workStartTime || null }),
      ...(input.workEndTime !== undefined && { workEndTime: input.workEndTime || null }),
    },
    select: campaignSelect,
  });

  logAudit(userId, 'update', 'campaigns', id, { changes: input }, req);
  return campaign;
}

export async function addAgent(campaignId: string, userId: string, requesterId: string, req?: Request) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw Object.assign(new Error('Campaign not found'), { code: 'NOT_FOUND' });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });

  await prisma.campaignAgent.upsert({
    where: { campaignId_userId: { campaignId, userId } },
    create: { campaignId, userId },
    update: {},
  });

  logAudit(requesterId, 'update', 'campaigns', campaignId, { addAgent: userId }, req);
}

export async function removeAgent(campaignId: string, userId: string, requesterId: string, req?: Request) {
  const existing = await prisma.campaignAgent.findUnique({
    where: { campaignId_userId: { campaignId, userId } },
  });
  if (!existing) throw Object.assign(new Error('Agent not assigned to campaign'), { code: 'NOT_FOUND' });

  await prisma.campaignAgent.delete({
    where: { campaignId_userId: { campaignId, userId } },
  });

  logAudit(requesterId, 'update', 'campaigns', campaignId, { removeAgent: userId }, req);
}
