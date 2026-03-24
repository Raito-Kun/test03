import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { parsePagination } from '../lib/pagination';
import * as macroService from '../services/macro-service';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  content: z.string().min(1),
  category: z.string().max(100).optional(),
  shortcut: z.string().max(50).optional(),
  isGlobal: z.boolean().optional(),
  isActive: z.boolean().optional(),
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

export async function listMacros(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const result = await macroService.listMacros(pagination, req.user!.userId, req.user!.role);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function createMacro(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createSchema.parse(req.body);

    // Enforce: only admin/manager can create global macros
    if (input.isGlobal && !['admin', 'manager'].includes(req.user!.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admin/manager can create global macros' },
      });
      return;
    }

    const macro = await macroService.createMacro(input, req.user!.userId, req);
    res.status(201).json({ success: true, data: macro });
  } catch (err) {
    handleErrors(err, res, next);
  }
}

export async function updateMacro(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateSchema.parse(req.body);
    const macro = await macroService.updateMacro(
      req.params.id as string,
      input,
      req.user!.userId,
      req.user!.role,
      req,
    );
    res.json({ success: true, data: macro });
  } catch (err) {
    handleErrors(err, res, next);
  }
}

export async function deleteMacro(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await macroService.deleteMacro(req.params.id as string, req.user!.userId, req.user!.role, req);
    res.json({ success: true, data: null });
  } catch (err) {
    handleErrors(err, res, next);
  }
}
