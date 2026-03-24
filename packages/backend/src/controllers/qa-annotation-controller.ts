import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { parsePagination } from '../lib/pagination';
import * as qaService from '../services/qa-annotation-service';

const createSchema = z.object({
  score: z.number().int().min(0).max(100),
  criteriaScores: z.any().optional(),
  comment: z.string().optional(),
  timestampNote: z.any().optional(),
});

const updateSchema = createSchema.partial();

function handleErrors(err: unknown, res: Response, next: NextFunction): void {
  const error = err as Error & { code?: string };
  if (error.code === 'NOT_FOUND') {
    res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
    return;
  }
  if (error.code === 'FORBIDDEN') {
    res.status(403).json({ success: false, error: { code: error.code, message: error.message } });
    return;
  }
  next(err);
}

/** POST /call-logs/:id/qa */
export async function createQa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createSchema.parse(req.body);
    const qa = await qaService.createQaAnnotation(req.params.id as string, input, req.user!.userId, req);
    res.status(201).json({ success: true, data: qa });
  } catch (err) {
    handleErrors(err, res, next);
  }
}

/** PATCH /qa-annotations/:id */
export async function updateQa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateSchema.parse(req.body);
    const qa = await qaService.updateQaAnnotation(req.params.id as string, input, req.user!.userId, req);
    res.json({ success: true, data: qa });
  } catch (err) {
    handleErrors(err, res, next);
  }
}

/** GET /qa-annotations */
export async function listQa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const filters = {
      callLogId: req.query.call_log_id as string | undefined,
      reviewerId: req.query.reviewer_id as string | undefined,
      startDate: req.query.start_date as string | undefined,
      endDate: req.query.end_date as string | undefined,
    };
    const result = await qaService.listQaAnnotations(pagination, filters);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
