import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as dispositionService from '../services/disposition-code-service';

const createSchema = z.object({
  code: z.string().min(1).max(50),
  label: z.string().min(1).max(255),
  category: z.enum(['telesale', 'collection', 'both']),
  isFinal: z.boolean().optional(),
  requiresCallback: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = createSchema.partial();

const setDispositionSchema = z.object({
  dispositionCodeId: z.string().uuid(),
  notes: z.string().optional(),
});

function handleNotFound(err: unknown, res: Response, next: NextFunction): void {
  const error = err as Error & { code?: string };
  if (error.code === 'NOT_FOUND') {
    res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
    return;
  }
  if (error.code === 'CONFLICT') {
    res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
    return;
  }
  next(err);
}

/** GET /disposition-codes */
export async function listDispositionCodes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const isActive = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
    const codes = await dispositionService.listDispositionCodes(isActive);
    res.json({ success: true, data: codes });
  } catch (err) {
    next(err);
  }
}

/** POST /disposition-codes */
export async function createDispositionCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createSchema.parse(req.body);
    const code = await dispositionService.createDispositionCode(input, req.user!.userId, req);
    res.status(201).json({ success: true, data: code });
  } catch (err) {
    handleNotFound(err, res, next);
  }
}

/** PATCH /disposition-codes/:id */
export async function updateDispositionCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateSchema.parse(req.body);
    const code = await dispositionService.updateDispositionCode(req.params.id as string, input, req.user!.userId, req);
    res.json({ success: true, data: code });
  } catch (err) {
    handleNotFound(err, res, next);
  }
}

/** DELETE /disposition-codes/:id */
export async function deleteDispositionCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await dispositionService.deleteDispositionCode(req.params.id as string, req.user!.userId, req);
    res.json({ success: true, data: null });
  } catch (err) {
    handleNotFound(err, res, next);
  }
}

/** POST /call-logs/:id/disposition */
export async function setCallDisposition(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = setDispositionSchema.parse(req.body);
    const result = await dispositionService.setCallDisposition(
      req.params.id as string,
      input.dispositionCodeId,
      input.notes,
      req.user!.userId,
      req,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    handleNotFound(err, res, next);
  }
}
