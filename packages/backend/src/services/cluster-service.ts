import prisma from '../lib/prisma';
import { logAudit } from '../lib/audit';
import logger from '../lib/logger';
import { Request } from 'express';
import eslDaemon from '../lib/esl-daemon';

const clusterSelect = {
  id: true,
  name: true,
  description: true,
  eslHost: true,
  eslPort: true,
  sipDomain: true,
  sipWssUrl: true,
  pbxIp: true,
  gatewayName: true,
  recordingPath: true,
  recordingUrlPrefix: true,
  cdrReportUrl: true,
  aiApiEndpoint: true,
  smtpHost: true,
  smtpPort: true,
  smtpUser: true,
  smtpFrom: true,
  sshUser: true,
  fusionpbxPgHost: true,
  fusionpbxPgPort: true,
  fusionpbxPgUser: true,
  fusionpbxPgDatabase: true,
  outboundDialplanNames: true,
  isActive: true,
  extSyncStatus: true,
  extSyncError: true,
  extSyncCount: true,
  extSyncFinishedAt: true,
  createdAt: true,
  updatedAt: true,
  // NOTE: eslPassword, aiApiKey, smtpPassword, sshPassword, fusionpbxPgPassword excluded for security
};

const MASK = '••••••••';

export async function listClusters(userClusterId?: string | null, userRole?: string) {
  // super_admin sees all clusters; others see only their own
  const where = userRole !== 'super_admin' && userClusterId ? { id: userClusterId } : {};
  return prisma.pbxCluster.findMany({ where, select: clusterSelect, orderBy: { createdAt: 'asc' } });
}

export async function getClusterById(id: string) {
  const cluster = await prisma.pbxCluster.findUnique({
    where: { id },
    select: { ...clusterSelect, eslPassword: true, aiApiKey: true, smtpPassword: true, sshPassword: true },
  });
  if (!cluster) throw Object.assign(new Error('Cluster not found'), { code: 'NOT_FOUND' });
  const full = await prisma.pbxCluster.findUnique({ where: { id }, select: { fusionpbxPgPassword: true } });
  return {
    ...cluster,
    eslPassword: cluster.eslPassword ? MASK : '',
    aiApiKey: cluster.aiApiKey ? MASK : '',
    smtpPassword: cluster.smtpPassword ? MASK : '',
    sshPassword: cluster.sshPassword ? MASK : '',
    fusionpbxPgPassword: full?.fusionpbxPgPassword ? MASK : '',
  };
}

export interface ClusterInput {
  name: string;
  description?: string | null;
  eslHost: string;
  eslPort?: number;
  eslPassword: string;
  sipDomain: string;
  sipWssUrl?: string | null;
  pbxIp?: string | null;
  gatewayName: string;
  recordingPath?: string | null;
  recordingUrlPrefix?: string | null;
  cdrReportUrl?: string | null;
  aiApiEndpoint?: string | null;
  aiApiKey?: string | null;
  smtpHost?: string | null;
  smtpPort?: number;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  smtpFrom?: string | null;
  sshUser?: string | null;
  sshPassword?: string | null;
  fusionpbxPgHost?: string | null;
  fusionpbxPgPort?: number;
  fusionpbxPgUser?: string | null;
  fusionpbxPgPassword?: string | null;
  fusionpbxPgDatabase?: string | null;
  outboundDialplanNames?: string[];
}

export async function createCluster(input: ClusterInput, userId: string, req?: Request) {
  const cluster = await prisma.pbxCluster.create({ data: input as any, select: clusterSelect });
  logAudit(userId, 'create', 'pbx_clusters', cluster.id, { new: { name: input.name, pbxIp: input.pbxIp } }, req);

  // Auto-create default accounts for the new cluster
  try {
    const { autoCreateClusterAccounts } = require('./extension-sync-service');
    await autoCreateClusterAccounts(cluster.id, input.name);
  } catch { /* non-critical */ }

  // Auto-sync extensions if SSH credentials are provided
  autoSyncExtensions(cluster.id);

  return cluster;
}

export async function updateCluster(id: string, input: Partial<ClusterInput>, userId: string, req?: Request) {
  const existing = await prisma.pbxCluster.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Cluster not found'), { code: 'NOT_FOUND' });
  const data = { ...input } as any;
  if (data.eslPassword === MASK) delete data.eslPassword;
  if (data.aiApiKey === MASK) delete data.aiApiKey;
  if (data.smtpPassword === MASK) delete data.smtpPassword;
  if (data.sshPassword === MASK) delete data.sshPassword;
  if (data.fusionpbxPgPassword === MASK) delete data.fusionpbxPgPassword;
  const cluster = await prisma.pbxCluster.update({ where: { id }, data, select: clusterSelect });
  logAudit(userId, 'update', 'pbx_clusters', id, { changes: { name: input.name } }, req);

  // Auto-sync extensions if SSH credentials changed or exist
  autoSyncExtensions(id);

  return cluster;
}

export async function deleteCluster(id: string, userId: string, req?: Request) {
  const existing = await prisma.pbxCluster.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Cluster not found'), { code: 'NOT_FOUND' });
  if (existing.isActive) throw Object.assign(new Error('Cannot delete active cluster'), { code: 'VALIDATION_ERROR' });
  await prisma.pbxCluster.delete({ where: { id } });
  logAudit(userId, 'delete', 'pbx_clusters', id, {}, req);
}

export async function switchCluster(id: string, userId: string, req?: Request) {
  const target = await prisma.pbxCluster.findUnique({ where: { id } });
  if (!target) throw Object.assign(new Error('Cluster not found'), { code: 'NOT_FOUND' });
  await prisma.$transaction([
    prisma.pbxCluster.updateMany({ data: { isActive: false } }),
    prisma.pbxCluster.update({ where: { id }, data: { isActive: true } }),
  ]);
  logAudit(userId, 'update', 'pbx_clusters', id, { switchTo: target.name }, req);
  return prisma.pbxCluster.findUnique({ where: { id }, select: clusterSelect });
}

export async function getActiveCluster() {
  return prisma.pbxCluster.findFirst({ where: { isActive: true }, select: clusterSelect });
}

/** Test ESL connection for a cluster using real password from DB */
export async function testConnection(id: string) {
  const cluster = await prisma.pbxCluster.findUnique({ where: { id } });
  if (!cluster) throw Object.assign(new Error('Cluster not found'), { code: 'NOT_FOUND' });

  // If this is the active cluster, check existing ESL daemon connection
  if (cluster.isActive) {
    const conn = eslDaemon.getConnection();
    if (conn) {
      return { message: `Kết nối ESL tới ${cluster.eslHost}:${cluster.eslPort} thành công` };
    }
    throw Object.assign(
      new Error(`ESL chưa kết nối tới ${cluster.eslHost}:${cluster.eslPort}`),
      { code: 'VALIDATION_ERROR' },
    );
  }

  // For inactive clusters, use enhanced test with real password from DB
  const { testConnectionEnhanced } = require('../services/network-scan-service');
  return testConnectionEnhanced(cluster.eslHost, cluster.eslPort || 8021, cluster.eslPassword);
}

/**
 * Fire-and-forget: auto-sync extensions if cluster has SSH credentials.
 * Runs in background but writes lifecycle (syncing/done/failed) back to the
 * cluster row so the UI can poll and surface progress/errors. Without this
 * state, a silent SSH failure looks identical to a successful sync with zero
 * extensions — the exact confusion that hit the 2026-04-22 hoangthienfinance
 * onboarding.
 */
function autoSyncExtensions(clusterId: string) {
  setImmediate(async () => {
    const cluster = await prisma.pbxCluster.findUnique({ where: { id: clusterId } });
    if (!cluster?.sshPassword) {
      await prisma.pbxCluster.update({
        where: { id: clusterId },
        data: { extSyncStatus: 'idle', extSyncError: null, extSyncFinishedAt: null, extSyncCount: null },
      });
      return;
    }

    await prisma.pbxCluster.update({
      where: { id: clusterId },
      data: { extSyncStatus: 'syncing', extSyncError: null },
    });

    try {
      const sshHost = cluster.pbxIp || cluster.eslHost;
      const sshUser = cluster.sshUser || 'root';
      const { syncExtensions } = require('./extension-sync-service');
      const result = await syncExtensions(clusterId, sshHost, cluster.sshPassword, cluster.sipDomain, sshUser);
      await prisma.pbxCluster.update({
        where: { id: clusterId },
        data: {
          extSyncStatus: 'done',
          extSyncError: null,
          extSyncCount: result.count,
          extSyncFinishedAt: new Date(),
        },
      });
      logger.info(`Auto-synced ${result.count} extensions for cluster ${cluster.name}`);
    } catch (err: any) {
      await prisma.pbxCluster.update({
        where: { id: clusterId },
        data: {
          extSyncStatus: 'failed',
          extSyncError: String(err?.message || err).slice(0, 500),
          extSyncFinishedAt: new Date(),
        },
      });
      logger.warn(`Auto-sync extensions failed for cluster ${clusterId}: ${err.message}`);
    }
  });
}
