import prisma from '../lib/prisma';
import { logAudit } from '../lib/audit';
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
  isActive: true,
  createdAt: true,
  updatedAt: true,
  // NOTE: eslPassword, aiApiKey, smtpPassword excluded for security
};

const MASK = '••••••••';

export async function listClusters() {
  return prisma.pbxCluster.findMany({ select: clusterSelect, orderBy: { createdAt: 'asc' } });
}

export async function getClusterById(id: string) {
  const cluster = await prisma.pbxCluster.findUnique({
    where: { id },
    select: { ...clusterSelect, eslPassword: true, aiApiKey: true, smtpPassword: true },
  });
  if (!cluster) throw Object.assign(new Error('Cluster not found'), { code: 'NOT_FOUND' });
  return {
    ...cluster,
    eslPassword: cluster.eslPassword ? MASK : '',
    aiApiKey: cluster.aiApiKey ? MASK : '',
    smtpPassword: cluster.smtpPassword ? MASK : '',
  };
}

export interface ClusterInput {
  name: string;
  description?: string;
  eslHost: string;
  eslPort?: number;
  eslPassword: string;
  sipDomain: string;
  sipWssUrl?: string;
  pbxIp: string;
  gatewayName: string;
  recordingPath?: string;
  recordingUrlPrefix?: string;
  cdrReportUrl?: string;
  aiApiEndpoint?: string;
  aiApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
}

export async function createCluster(input: ClusterInput, userId: string, req?: Request) {
  const cluster = await prisma.pbxCluster.create({ data: input as any, select: clusterSelect });
  logAudit(userId, 'create', 'pbx_clusters', cluster.id, { new: { name: input.name, pbxIp: input.pbxIp } }, req);
  return cluster;
}

export async function updateCluster(id: string, input: Partial<ClusterInput>, userId: string, req?: Request) {
  const existing = await prisma.pbxCluster.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error('Cluster not found'), { code: 'NOT_FOUND' });
  const data = { ...input } as any;
  if (data.eslPassword === MASK) delete data.eslPassword;
  if (data.aiApiKey === MASK) delete data.aiApiKey;
  if (data.smtpPassword === MASK) delete data.smtpPassword;
  const cluster = await prisma.pbxCluster.update({ where: { id }, data, select: clusterSelect });
  logAudit(userId, 'update', 'pbx_clusters', id, { changes: { name: input.name } }, req);
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

/** Test ESL connection for a cluster. If active cluster, check existing connection. */
export async function testConnection(id: string): Promise<{ message: string }> {
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

  // For inactive clusters, try a quick ESL connection
  const esl = require('modesl');
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(Object.assign(new Error(`Timeout kết nối tới ${cluster.eslHost}:${cluster.eslPort}`), { code: 'VALIDATION_ERROR' }));
    }, 5000);

    try {
      const conn = new esl.Connection(cluster.eslHost, cluster.eslPort, cluster.eslPassword, () => {
        clearTimeout(timeout);
        conn.disconnect?.();
        resolve({ message: `Kết nối ESL tới ${cluster.eslHost}:${cluster.eslPort} thành công` });
      });
      conn.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(Object.assign(new Error(`Không thể kết nối ESL: ${err.message}`), { code: 'VALIDATION_ERROR' }));
      });
    } catch (err) {
      clearTimeout(timeout);
      reject(Object.assign(new Error(`Lỗi kết nối ESL: ${(err as Error).message}`), { code: 'VALIDATION_ERROR' }));
    }
  });
}
