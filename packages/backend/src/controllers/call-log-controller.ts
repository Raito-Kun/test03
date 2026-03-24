import { Request, Response, NextFunction } from 'express';
import { parsePagination } from '../lib/pagination';
import * as callLogService from '../services/call-log-service';
import * as ctrl from '../controllers/call-controller';

export { getRecording } from './call-controller';

/** GET /call-logs */
export async function listCallLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const filters = {
      startDate: req.query.start_date as string | undefined,
      endDate: req.query.end_date as string | undefined,
      userId: req.query.user_id as string | undefined,
      direction: req.query.direction as string | undefined,
      disposition: req.query.disposition as string | undefined,
      campaignId: req.query.campaign_id as string | undefined,
    };
    const result = await callLogService.listCallLogs(pagination, filters, req.dataScope || {});
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** GET /call-logs/:id */
export async function getCallLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const log = await callLogService.getCallLogById(req.params.id as string, req.dataScope || {});
    res.json({ success: true, data: log });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

void ctrl; // suppress unused
