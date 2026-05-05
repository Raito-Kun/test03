import { Request, Response, NextFunction } from 'express';
import * as extensionService from '../services/extension-service';

/** GET /api/v1/extensions */
export async function listExtensionsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await extensionService.listExtensions(req.user?.clusterId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/extensions/:ext/assign */
export async function assignExtensionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ext = String(req.params.ext ?? '');
    const { userId } = req.body as { userId?: string | null };

    if (!/^\d{1,10}$/.test(ext)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid extension format' } });
      return;
    }

    await extensionService.assignExtension(ext, userId ?? null);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
