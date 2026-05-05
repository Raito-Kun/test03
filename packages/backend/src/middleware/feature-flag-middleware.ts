import { Request, Response, NextFunction } from 'express';
import { isFeatureEnabled } from '../services/feature-flag-service';

/**
 * Middleware factory: blocks request if the feature is disabled for the user's cluster.
 * Returns 403 with Vietnamese message when feature is OFF.
 */
export function checkFeatureEnabled(...featureKeys: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clusterId = req.user?.clusterId;
      const role = req.user?.role;
      for (const key of featureKeys) {
        const enabled = await isFeatureEnabled(key, clusterId, role);
        if (!enabled) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FEATURE_DISABLED',
              message: 'Tính năng này chưa được kích hoạt cho cụm hiện tại',
            },
          });
          return;
        }
      }
      next();
    } catch {
      next(); // on error, allow through (fail-open)
    }
  };
}
