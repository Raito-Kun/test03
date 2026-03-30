import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { CampaignStatus, LeadStatus } from '@prisma/client';

export interface CampaignProgress {
  campaignId: string;
  campaignName: string;
  totalLeads: number;
  contactedLeads: number;
  wonLeads: number;
  lostLeads: number;
  progressPercent: number;
  conversionPercent: number;
}

type ProgressQuery = Record<string, unknown>;

function calcPercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export async function getCampaignProgress(campaignId: string): Promise<CampaignProgress> {
  try {
    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { id: true, name: true },
    });

    const grouped = await prisma.lead.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { id: true },
    });

    let totalLeads = 0;
    let wonLeads = 0;
    let lostLeads = 0;
    let contactedLeads = 0;

    for (const row of grouped) {
      const count = row._count.id;
      totalLeads += count;
      if (row.status === LeadStatus.won) wonLeads += count;
      else if (row.status === LeadStatus.lost) lostLeads += count;
      if (row.status !== LeadStatus.new) contactedLeads += count;
    }

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      totalLeads,
      contactedLeads,
      wonLeads,
      lostLeads,
      progressPercent: calcPercent(contactedLeads, totalLeads),
      conversionPercent: calcPercent(wonLeads, totalLeads),
    };
  } catch (error) {
    logger.error('getCampaignProgress failed', { campaignId, error });
    throw error;
  }
}

export async function getAllCampaignProgress(query: ProgressQuery = {}): Promise<CampaignProgress[]> {
  try {
    const where: Record<string, unknown> = { status: CampaignStatus.active };
    if (query.type) where.type = query.type;

    const campaigns = await prisma.campaign.findMany({
      where,
      select: { id: true, name: true },
    });

    const results = await Promise.all(campaigns.map((c) => getCampaignProgress(c.id)));
    return results;
  } catch (error) {
    logger.error('getAllCampaignProgress failed', error);
    throw error;
  }
}
