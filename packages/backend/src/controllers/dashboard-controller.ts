import { Request, Response, NextFunction } from 'express';
import * as dashboardService from '../services/dashboard-service';

/** GET /dashboard/overview */
export async function getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await dashboardService.getOverview(
      req.dataScope || {},
      req.user!.role,
      req.user!.teamId,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /dashboard/agents */
export async function getAgentsDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const agents = await dashboardService.getAgentsDashboard(req.user!.role, req.user!.teamId);
    res.json({ success: true, data: agents });
  } catch (err) {
    next(err);
  }
}
