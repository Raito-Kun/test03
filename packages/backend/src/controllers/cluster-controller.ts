import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as clusterService from '../services/cluster-service';
import * as networkScanService from '../services/network-scan-service';
import * as extensionService from '../services/extension-sync-service';
import { runPreflight, listClusterDialplans } from '../services/pbx-preflight-service';

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
  pbxIp: optStr,
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
  sshUser: optStr,
  sshPassword: optStr,
  fusionpbxPgHost: optStr,
  fusionpbxPgPort: optPort,
  fusionpbxPgUser: optStr,
  fusionpbxPgPassword: optStr,
  fusionpbxPgDatabase: optStr,
  outboundDialplanNames: z.array(z.string()).optional(),
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
    const clusters = await clusterService.listClusters(req.user?.clusterId, req.user?.role);
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
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function testConnectionDirect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { eslHost, eslPort, eslPassword } = req.body;
    if (!eslHost || !eslPassword) {
      res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'eslHost và eslPassword là bắt buộc' } });
      return;
    }
    const result = await networkScanService.testConnectionEnhanced(eslHost, eslPort || 8021, eslPassword);
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function sshDiscover(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sshHost, sshPort, sshUser, sshPassword } = req.body;
    if (!sshHost || !sshPassword) {
      res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'sshHost và sshPassword là bắt buộc' } });
      return;
    }
    const result = await networkScanService.sshDiscover({ sshHost, sshPort, sshUser, sshPassword });
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function syncExtensions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Get full cluster from DB (with real passwords, not masked)
    const fullCluster = await require('../lib/prisma').default.pbxCluster.findUnique({ where: { id: req.params.id } });
    if (!fullCluster) { res.status(404).json({ success: false, error: { message: 'Cluster không tồn tại' } }); return; }

    // SSH password can be overridden in request body (for one-time sync without saving)
    const sshPassword = req.body.sshPassword || fullCluster.sshPassword || '';
    const sshUser = req.body.sshUser || fullCluster.sshUser || 'root';
    const sshHost = fullCluster.pbxIp || fullCluster.eslHost;

    if (!sshPassword) {
      res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Chưa cấu hình SSH password cho cụm. Vui lòng nhập SSH password.' } });
      return;
    }

    const clusterId = req.params.id as string;
    const prismaClient = require('../lib/prisma').default;
    await prismaClient.pbxCluster.update({
      where: { id: clusterId },
      data: { extSyncStatus: 'syncing', extSyncError: null },
    });

    try {
      const result = await extensionService.syncExtensions(
        clusterId,
        sshHost,
        sshPassword,
        fullCluster.sipDomain,
        sshUser,
      );
      await prismaClient.pbxCluster.update({
        where: { id: clusterId },
        data: {
          extSyncStatus: 'done',
          extSyncError: null,
          extSyncCount: result.count,
          extSyncFinishedAt: new Date(),
        },
      });
      res.json({ success: true, data: result });
    } catch (syncErr: any) {
      await prismaClient.pbxCluster.update({
        where: { id: clusterId },
        data: {
          extSyncStatus: 'failed',
          extSyncError: String(syncErr?.message || syncErr).slice(0, 500),
          extSyncFinishedAt: new Date(),
        },
      });
      throw syncErr;
    }
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function listExtensions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const extensions = await extensionService.listExtensions(req.params.id as string);
    res.json({ success: true, data: extensions });
  } catch (err) {
    next(err);
  }
}

export async function clusterPreflight(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await runPreflight(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(err, res, next);
  }
}

export async function clusterDialplans(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rules = await listClusterDialplans(req.params.id as string);
    res.json({ success: true, data: rules });
  } catch (err) {
    handleError(err, res, next);
  }
}
