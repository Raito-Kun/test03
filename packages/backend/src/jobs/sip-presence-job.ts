/**
 * Periodic SIP presence poller.
 * Every 30s, for EACH PBX cluster: fetch registered extensions scoped to that
 * cluster's sipDomain (via sip_realm filter — see sip-presence-service.ts),
 * then persist to:
 *   - users.sip_registered               (scoped WHERE clusterId = cluster.id)
 *   - cluster_extensions.sip_registered  (scoped WHERE clusterId = cluster.id)
 *
 * Per-cluster iteration + domain-scoped fetch prevents the cross-tenant
 * presence leak where ext `105` on tenant A (shared PBX) would flag ext `105`
 * on tenant B as online. Symmetric fix to commits 1d0c429 (CDR) and the
 * monitoring-service domain filter (live calls).
 */
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { fetchRegisteredExtensions, RegisteredExtension } from '../services/sip-presence-service';

const INTERVAL_MS = 30 * 1000;

async function syncUsersForCluster(clusterId: string, regSet: Set<string>, now: Date): Promise<{ scanned: number; changed: number }> {
  const users = await prisma.user.findMany({
    select: { id: true, sipExtension: true, extension: true, sipRegistered: true },
    where: { clusterId, status: 'active', OR: [{ sipExtension: { not: null } }, { extension: { not: null } }] },
  });
  let changed = 0;
  for (const u of users) {
    const ext = u.extension || u.sipExtension;
    if (!ext) continue;
    const isReg = regSet.has(ext);
    if (isReg !== u.sipRegistered) {
      await prisma.user.update({
        where: { id: u.id },
        data: { sipRegistered: isReg, sipRegisteredAt: isReg ? now : null },
      });
      changed++;
    }
  }
  return { scanned: users.length, changed };
}

async function syncClusterExtensionsForCluster(clusterId: string, regs: RegisteredExtension[], now: Date): Promise<{ scanned: number; changed: number }> {
  const byExt = new Map(regs.map((r) => [r.extension, r]));
  const rows = await prisma.clusterExtension.findMany({
    where: { clusterId },
    select: { id: true, extension: true, sipRegistered: true },
  });
  let changed = 0;
  for (const row of rows) {
    const reg = byExt.get(row.extension);
    const isReg = !!reg;
    if (isReg !== row.sipRegistered) {
      await prisma.clusterExtension.update({
        where: { id: row.id },
        data: {
          sipRegistered: isReg,
          sipRegisteredAt: isReg ? now : null,
          networkIp: isReg ? reg?.networkIp || null : null,
        },
      });
      changed++;
    }
  }
  return { scanned: rows.length, changed };
}

async function runOnce(): Promise<void> {
  const started = Date.now();
  const now = new Date();

  // Poll every cluster (active + inactive). Inactive clusters still have users
  // and extensions, and the presence flag should reflect truth — not freeze on
  // whatever value was written when the cluster was last active.
  const clusters = await prisma.pbxCluster.findMany({
    select: { id: true, name: true, pbxIp: true, sipDomain: true, sshUser: true, sshPassword: true },
  });

  for (const c of clusters) {
    if (!c.pbxIp || !c.sipDomain) continue;
    try {
      const { extensions, source } = await fetchRegisteredExtensions({
        pbxIp: c.pbxIp,
        sipDomain: c.sipDomain,
        sshUser: c.sshUser,
        sshPassword: c.sshPassword,
      });
      if (source === 'unconfigured') continue;

      const regSet = new Set(extensions.map((e) => e.extension));
      const [userSync, extSync] = await Promise.all([
        syncUsersForCluster(c.id, regSet, now),
        syncClusterExtensionsForCluster(c.id, extensions, now),
      ]);

      logger.info('SIP presence sync (cluster)', {
        cluster: c.name,
        domain: c.sipDomain,
        source,
        registered: regSet.size,
        users: userSync.scanned,
        usersChanged: userSync.changed,
        extensions: extSync.scanned,
        extensionsChanged: extSync.changed,
      });
    } catch (err) {
      const e = err as Error;
      logger.error('SIP presence job (cluster) failed', { cluster: c.name, error: e.message });
    }
  }

  logger.info('SIP presence sync (all clusters)', { ms: Date.now() - started, clusters: clusters.length });
}

let handle: ReturnType<typeof setInterval> | null = null;

export function startSipPresenceJob(): void {
  if (handle) return;
  logger.info('SIP presence job started', { intervalMs: INTERVAL_MS });
  runOnce().catch(() => undefined);
  handle = setInterval(() => { runOnce().catch(() => undefined); }, INTERVAL_MS);
}

export function stopSipPresenceJob(): void {
  if (handle) { clearInterval(handle); handle = null; }
}
