import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { parsePagination } from '../lib/pagination';
import * as debtCaseService from '../services/debt-case-service';

const createDebtCaseSchema = z.object({
  contactId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  originalAmount: z.number().positive(),
  outstandingAmount: z.number().positive(),
  dpd: z.number().min(0).optional(),
  assignedTo: z.string().uuid().optional(),
});

const updateDebtCaseSchema = z.object({
  status: z.enum(['active', 'in_progress', 'promise_to_pay', 'paid', 'written_off']).optional(),
  dpd: z.number().min(0).optional(),
  outstandingAmount: z.number().positive().optional(),
  assignedTo: z.string().uuid().optional(),
});

const ptpSchema = z.object({
  promiseDate: z.string(),
  promiseAmount: z.number().positive(),
});

export async function listDebtCases(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const filters = {
      status: req.query.status as string | undefined,
      tier: req.query.tier as string | undefined,
      campaignId: req.query.campaign_id as string | undefined,
      assignedTo: req.query.assigned_to as string | undefined,
    };
    const result = await debtCaseService.listDebtCases(pagination, filters, req.dataScope || {});
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function createDebtCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createDebtCaseSchema.parse(req.body);
    const debtCase = await debtCaseService.createDebtCase(input, req.user!.userId, req);
    res.status(201).json({ success: true, data: debtCase });
  } catch (err) {
    next(err);
  }
}

export async function updateDebtCase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateDebtCaseSchema.parse(req.body);
    const debtCase = await debtCaseService.updateDebtCase(req.params.id as string, input, req.user!.userId, req.dataScope || {}, req);
    res.json({ success: true, data: debtCase });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

export async function recordPTP(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { promiseDate, promiseAmount } = ptpSchema.parse(req.body);
    const debtCase = await debtCaseService.recordPTP(
      req.params.id as string, promiseDate, promiseAmount, req.user!.userId, req.dataScope || {}, req,
    );
    res.json({ success: true, data: debtCase });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}
