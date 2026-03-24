import { Request, Response, NextFunction } from 'express';
import { parsePagination } from '../lib/pagination';
import * as notifService from '../services/notification-service';

/** GET /notifications */
export async function listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pagination = parsePagination(req);
    const isRead = req.query.is_read === 'true' ? true : req.query.is_read === 'false' ? false : undefined;
    const result = await notifService.listNotifications(pagination, req.user!.userId, isRead);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** PATCH /notifications/:id/read */
export async function markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const notif = await notifService.markAsRead(req.params.id as string, req.user!.userId);
    res.json({ success: true, data: notif });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(err);
  }
}

/** PATCH /notifications/read-all */
export async function markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await notifService.markAllAsRead(req.user!.userId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
