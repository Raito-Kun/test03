import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as agentStatusService from '../services/agent-status-service';
import { AgentStatus } from '@prisma/client';

const manualStatuses: AgentStatus[] = ['ready', 'break', 'offline'];

const setStatusSchema = z.object({
  status: z.enum(['ready', 'break', 'offline']),
  reason: z.string().max(255).optional(),
});

/** PUT /agents/status */
export async function setMyStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = setStatusSchema.parse(req.body);
    const userId = req.user!.userId;
    const info = await agentStatusService.setAgentStatus(userId, input.status as AgentStatus, input.reason);
    res.json({ success: true, data: info });
  } catch (err) {
    next(err);
  }
}

/** GET /agents/status */
export async function getMyStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const info = await agentStatusService.getAgentStatus(userId);
    res.json({ success: true, data: info });
  } catch (err) {
    next(err);
  }
}

/** GET /agents/statuses — admin/manager/leader */
export async function getAllStatuses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const statuses = await agentStatusService.getAllAgentStatuses();
    res.json({ success: true, data: statuses });
  } catch (err) {
    next(err);
  }
}

// suppress unused warning
void manualStatuses;
