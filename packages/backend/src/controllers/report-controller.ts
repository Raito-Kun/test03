import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as reportService from '../services/report-service';

const dateRangeSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  group_by: z.enum(['day', 'agent', 'direction']).optional(),
  user_id: z.string().uuid().optional(),
  campaign_id: z.string().uuid().optional(),
});

function parseFilters(query: Record<string, unknown>) {
  const parsed = dateRangeSchema.parse(query);
  return {
    startDate: parsed.start_date,
    endDate: parsed.end_date,
    groupBy: parsed.group_by as 'day' | 'agent' | 'direction' | undefined,
    userId: parsed.user_id,
    campaignId: parsed.campaign_id,
  };
}

/** GET /reports/calls */
export async function getCallReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const data = await reportService.getCallReport(filters, req.dataScope || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /reports/telesale */
export async function getTelesaleReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const data = await reportService.getTelesaleReport(filters, req.dataScope || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /reports/collection */
export async function getCollectionReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const data = await reportService.getCollectionReport(filters, req.dataScope || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
