import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { parsePagination } from '../lib/pagination';
import * as leadService from '../services/lead-service';

const createLeadSchema = z.object({
  contactId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']).optional(),
  score: z.number().min(0).max(100).optional(),
  leadScore: z.number().min(0).optional(),
  product: z.string().optional(),
  budget: z.number().nonnegative().optional(),
  assignedTo: z.string().uuid().optional(),
  nextFollowUp: z.string().optional(),
  notes: z.string().optional(),
});

const updateLeadSchema = createLeadSchema.partial().extend({
  lostReason: z.string().optional(),
  wonAmount: z.number().optional(),
});

export async function listLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const filters = {
      status: req.query.status as string | undefined,
      campaignId: req.query.campaign_id as string | undefined,
      assignedTo: req.query.assigned_to as string | undefined,
      search: req.query.search as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };
    const result = await leadService.listLeads(pagination, filters, req.dataScope || {});
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function createLead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createLeadSchema.parse(req.body);
    const lead = await leadService.createLead(input, req.user!.userId, req);
    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
}

export async function updateLead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateLeadSchema.parse(req.body);
    const lead = await leadService.updateLead(req.params.id as string, input, req.user!.userId, req.dataScope || {}, req);
    res.json({ success: true, data: lead });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}
