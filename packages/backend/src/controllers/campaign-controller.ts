import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { parsePagination } from '../lib/pagination';
import * as campaignService from '../services/campaign-service';

const campaignBaseSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['telesale', 'collection']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  script: z.string().optional(),
  category: z.enum(['telesale', 'collection', 'customer_service']).optional(),
  queue: z.string().optional(),
  dialMode: z.enum(['manual', 'auto_dialer', 'power_dialer']).optional(),
  callbackUrl: z.string().url().optional().or(z.literal('')),
  workSchedule: z.enum(['all_day', 'business_hours', 'custom']).optional(),
  workStartTime: z.string().optional(),
  workEndTime: z.string().optional(),
});

const createCampaignSchema = campaignBaseSchema;

const updateCampaignSchema = campaignBaseSchema.partial().extend({
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
});

const addAgentSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});

function handleNotFound(err: unknown, res: Response, next: NextFunction) {
  const error = err as Error & { code?: string };
  if (error.code === 'NOT_FOUND') {
    res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
    return true;
  }
  next(err);
  return false;
}

export async function listCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const filters = {
      type: req.query.type as string | undefined,
      status: req.query.status as string | undefined,
    };
    const result = await campaignService.listCampaigns(pagination, filters, req.user!.clusterId, req.user!.role);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getCampaignById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const campaign = await campaignService.findById(req.params.id as string);
    res.json({ success: true, data: campaign });
  } catch (err) {
    handleNotFound(err, res, next);
  }
}

export async function createCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createCampaignSchema.parse(req.body);
    const campaign = await campaignService.createCampaign(input, req.user!.userId, req, req.user!.clusterId);
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
}

export async function updateCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateCampaignSchema.parse(req.body);
    const campaign = await campaignService.updateCampaign(req.params.id as string, input, req.user!.userId, req);
    res.json({ success: true, data: campaign });
  } catch (err) {
    handleNotFound(err, res, next);
  }
}

export async function addCampaignAgents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userIds } = addAgentSchema.parse(req.body);
    await Promise.all(
      userIds.map((userId) => campaignService.addAgent(req.params.id as string, userId, req.user!.userId, req)),
    );
    res.json({ success: true, message: `${userIds.length} agent(s) assigned` });
  } catch (err) {
    handleNotFound(err, res, next);
  }
}

export async function removeCampaignAgent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await campaignService.removeAgent(req.params.id as string, req.params.userId as string, req.user!.userId, req);
    res.json({ success: true, message: 'Agent removed' });
  } catch (err) {
    handleNotFound(err, res, next);
  }
}
