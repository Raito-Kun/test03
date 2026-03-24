import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as categoryService from '../services/ticket-category-service';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = createSchema.partial();

function handleErrors(err: unknown, res: Response, next: NextFunction): void {
  const error = err as Error & { code?: string };
  if (error.code === 'NOT_FOUND') {
    res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
    return;
  }
  next(err);
}

export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const isActive = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
    const cats = await categoryService.listCategories(isActive);
    res.json({ success: true, data: cats });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createSchema.parse(req.body);
    const cat = await categoryService.createCategory(input, req.user!.userId, req);
    res.status(201).json({ success: true, data: cat });
  } catch (err) {
    handleErrors(err, res, next);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateSchema.parse(req.body);
    const cat = await categoryService.updateCategory(req.params.id as string, input, req.user!.userId, req);
    res.json({ success: true, data: cat });
  } catch (err) {
    handleErrors(err, res, next);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await categoryService.deleteCategory(req.params.id as string, req.user!.userId, req);
    res.json({ success: true, data: null });
  } catch (err) {
    handleErrors(err, res, next);
  }
}
