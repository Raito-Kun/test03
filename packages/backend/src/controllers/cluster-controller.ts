import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as clusterService from '../services/cluster-service';

const clusterBaseSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  eslHost: z.string().min(1),
  eslPort: z.number().int().min(1).max(65535).optional(),
  eslPassword: z.string().min(1),
  sipDomain: z.string().min(1),
  sipWssUrl: z.string().optional(),
  pbxIp: z.string().min(1),
  gatewayName: z.string().min(1),
  recordingPath: z.string().optional(),
  recordingUrlPrefix: z.string().optional(),
  cdrReportUrl: z.string().optional(),
  aiApiEndpoint: z.string().optional(),
  aiApiKey: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.preprocess((v) => (v === 0 || v === null || Number.isNaN(v) ? undefined : v), z.number().int().min(1).max(65535).optional()),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpFrom: z.string().optional(),
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
