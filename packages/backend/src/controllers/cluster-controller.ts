import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as clusterService from '../services/cluster-service';

// nullish() accepts string | null | undefined — needed because DB returns null for empty optional fields
const optStr = z.string().nullish();
const optPort = z.preprocess(
  (v) => (v === 0 || v === null || v === undefined || Number.isNaN(v as number) ? undefined : v),
  z.number().int().min(1).max(65535).optional(),
);

const clusterBaseSchema = z.object({
  name: z.string().min(1).max(255),
  description: optStr,
  eslHost: z.string().min(1),
  eslPort: optPort,
  eslPassword: z.string().min(1),
  sipDomain: z.string().min(1),
  sipWssUrl: optStr,
  pbxIp: z.string().min(1),
  gatewayName: z.string().min(1),
  recordingPath: optStr,
  recordingUrlPrefix: optStr,
  cdrReportUrl: optStr,
  aiApiEndpoint: optStr,
  aiApiKey: optStr,
  smtpHost: optStr,
  smtpPort: optPort,
  smtpUser: optStr,
  smtpPassword: optStr,
  smtpFrom: optStr,
});

const updateClusterSchema = clusterBaseSchema.partial();

function handleError(err: unknown, res: Response, next: NextFunction) {
  const error = err as Error & { code?: string };
  if (error.code === 'NOT_FOUND') {
    res.status(404).json({ success: false, error: { code: error.code, message: error.message } });
    return;
  }
  if (error.code === 'VALIDATION_ERROR') {
    res.status(422).json({ success: false, error: { code: error.code, message: error.message } });
    return;
  }
  next(err);
}

export async function listClusters(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clusters = await clusterService.listClusters();
    res.json({ success: true, data: clusters });
  } catch (err) {
    next(err);
  }
}

export async function getCluster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cluster = await clusterService.getClusterById(req.params.id as string);
    res.json({ success: true, data: cluster });
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function createCluster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = clusterBaseSchema.parse(req.body);
    const cluster = await clusterService.createCluster(input, req.user!.userId, req);
    res.status(201).json({ success: true, data: cluster });
  } catch (err) {
    next(err);
  }
}

export async function updateCluster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateClusterSchema.parse(req.body);
    const cluster = await clusterService.updateCluster(req.params.id as string, input, req.user!.userId, req);
    res.json({ success: true, data: cluster });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ') } });
      return;
    }
    handleError(err, res, next);
  }
}

export async function deleteCluster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await clusterService.deleteCluster(req.params.id as string, req.user!.userId, req);
    res.json({ success: true, message: 'Cluster deleted' });
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function switchCluster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cluster = await clusterService.switchCluster(req.params.id as string, req.user!.userId, req);
    res.json({ success: true, data: cluster });
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function getActiveCluster(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cluster = await clusterService.getActiveCluster();
    res.json({ success: true, data: cluster });
  } catch (err) {
    next(err);
  }
}

export async function testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await clusterService.testConnection(req.params.id as string);
    res.json({ success: true, message: result.message });
  } catch (err) {
    handleError(err, res, next);
  }
}
