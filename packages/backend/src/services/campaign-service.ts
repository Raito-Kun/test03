import prisma from '../lib/prisma';
import { PaginationParams, paginatedResponse } from '../lib/pagination';
import { logAudit } from '../lib/audit';
import { Request } from 'express';

const campaignSelect = {
  id: true,
  name: true,
  type: true,
  status: true,
  startDate: true,
  endDate: true,
  script: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { leads: true, debtCases: true, callLogs: true } },
};

interface ListCampaignsFilter {
  type?: string;
  status?: string;
}

export async function listCampaigns(pagination: PaginationParams, filters: ListCampaignsFilter) {
  const where: Record<string, unknown> = {};
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({ where, select: campaignSelect, skip: pagination.skip, take: pagination.limit, orderBy: pagination.orderBy }),
    prisma.campaign.count({ where }),
  ]);

  return paginatedResponse(campaigns, total, pagination.page, pagination.limit);
}

interface CreateCampaignInput {
  name: string;
  type: string;
  startDate?: string;
  endDate?: string;
  script?: string;
}

export async function createCampaign(input: CreateCampaignInput, userId: string, req?: Request) {
  const campaign = await prisma.campaign.create({
    data: {
      name: input.name,
      type: input.type as never,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      script: input.script || null,
      createdBy: userId,
    },
    select: campaignSelect,
  });

  logAudit(userId, 'create', 'campaigns', campaign.id, { new: input }, req);
  return campaign;
}

export async function updateCampaign(id: string, input: Partial<CreateCampaignInput> & { status?: string }, userId: string, req?: Request) {
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
    },
    select: campaignSelect,
  });

  logAudit(userId, 'update', 'campaigns', id, { changes: input }, req);
  return campaign;
}
