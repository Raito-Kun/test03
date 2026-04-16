import { Request, Response } from 'express';
import { z } from 'zod';
import * as featureFlagService from '../services/feature-flag-service';

/** GET /api/v1/feature-flags?clusterId=&domain= */
export async function getFlags(req: Request, res: Response) {
  try {
    const clusterId = req.query.clusterId as string;
    if (!clusterId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'clusterId is required' } });
      return;
    }
    const domain = req.query.domain as string | undefined;
    const flags = await featureFlagService.getFeatureFlags(clusterId, domain);
    const domains = await featureFlagService.getFlagDomains(clusterId);
    res.json({ success: true, data: { flags, domains } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL', message: err.message } });
  }
}

const bulkUpdateSchema = z.object({
  clusterId: z.string().uuid(),
  domainName: z.string().default(''),
  flags: z.array(z.object({
    featureKey: z.string().min(1),
    isEnabled: z.boolean(),
  })).min(1),
});

/** PUT /api/v1/feature-flags */
export async function bulkUpdateFlags(req: Request, res: Response) {
  try {
    const parsed = bulkUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
      return;
    }
    const { clusterId, domainName, flags } = parsed.data;
    const count = await featureFlagService.bulkUpsertFlags(clusterId, domainName, flags, req.user!.userId, req);
    res.json({ success: true, data: { updated: count } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL', message: err.message } });
  }
}

/** GET /api/v1/feature-flags/effective — returns effective flags for current user's cluster */
export async function getEffectiveFlags(req: Request, res: Response) {
  try {
    const flags = await featureFlagService.getEffectiveFlags(req.user?.clusterId);
    res.json({ success: true, data: flags });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL', message: err.message } });
  }
}
