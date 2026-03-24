import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { parsePagination } from '../lib/pagination';
import * as teamService from '../services/team-service';

const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  leaderId: z.string().uuid().optional(),
  type: z.enum(['telesale', 'collection']),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  leaderId: z.string().uuid().nullable().optional(),
  type: z.enum(['telesale', 'collection']).optional(),
  isActive: z.boolean().optional(),
});

/** GET /teams */
export async function listTeams(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const result = await teamService.listTeams(pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** POST /teams */
export async function createTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createTeamSchema.parse(req.body);
    const team = await teamService.createTeam(input);
    res.status(201).json({ success: true, data: team });
  } catch (err) {
    next(err);
  }
}

/** PATCH /teams/:id */
export async function updateTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateTeamSchema.parse(req.body);
    const team = await teamService.updateTeam(req.params.id as string, input);
    res.json({ success: true, data: team });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** DELETE /teams/:id */
export async function deleteTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const team = await teamService.deactivateTeam(req.params.id as string);
    res.json({ success: true, data: team });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** GET /teams/:id/members */
export async function getTeamMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const members = await teamService.getTeamMembers(req.params.id as string);
    res.json({ success: true, data: members });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}
