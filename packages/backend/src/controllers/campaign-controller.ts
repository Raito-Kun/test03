import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { parsePagination } from '../lib/pagination';
import * as campaignService from '../services/campaign-service';

const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['telesale', 'collection']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  script: z.string().optional(),
});

const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
});

export async function listCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const filters = {
      type: req.query.type as string | undefined,
      status: req.query.status as string | undefined,
    };
    const result = await campaignService.listCampaigns(pagination, filters);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function createCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createCampaignSchema.parse(req.body);
    const campaign = await campaignService.createCampaign(input, req.user!.userId, req);
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
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}
