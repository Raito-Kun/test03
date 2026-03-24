import { Request, Response, NextFunction } from 'express';
import { createUserSchema, updateUserSchema } from '@crm/shared/src/validation/auth-schemas';
import { parsePagination } from '../lib/pagination';
import * as userService from '../services/user-service';

/** GET /users */
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const filters = {
      role: req.query.role as string | undefined,
      teamId: req.query.team_id as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
    };

    const result = await userService.listUsers(pagination, filters);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** POST /users */
export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createUserSchema.parse(req.body);
    const user = await userService.createUser(input);
    res.status(201).json({ success: true, data: user });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'EMAIL_EXISTS') {
      res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** GET /users/:id */
export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.getUserById(req.params.id as string);
    res.json({ success: true, data: user });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** PATCH /users/:id */
export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateUserSchema.parse(req.body);
    const user = await userService.updateUser(req.params.id as string, input);
    res.json({ success: true, data: user });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** DELETE /users/:id */
export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.deactivateUser(req.params.id as string);
    res.json({ success: true, data: user });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}
