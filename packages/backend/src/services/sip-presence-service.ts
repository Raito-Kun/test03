/**
 * SIP presence detection from FusionPBX.
 * Primary: query FusionPBX PostgreSQL directly for active sip_registrations.
 * Fallback: SSH to FusionPBX and query sofia_reg SQLite DBs.
 *
 * Multi-tenant rule: one PBX host can serve multiple domains (e.g.
 * 10.10.101.206 runs both `blueva` and `hoangthienfinance.vn`). Ext `105`
 * can exist on both — sip_registrations is shared. Callers MUST pass the
 * cluster's sipDomain so we filter by `sip_realm` and avoid the cross-tenant
 * presence leak (symmetric to the 2026-04-17 CDR leak).
 */
import logger from '../lib/logger';

export interface RegisteredExtension {
  extension: string;
  networkIp: string;
  expiresAt: Date | null;
}

function parseBool(v: string | undefined, def = false): boolean {
  if (!v) return def;
  return v.toLowerCase() === 'true' || v === '1';
}

// Defensive: sip_realm in queries is either parameterised (PG) or shell-escaped (SQLite).
// Domain names should never contain quotes/semicolons, but strip anything non-domain-safe
// before interpolating into the SQLite cmd string.
function sanitizeDomain(d: string): string {
  return d.replace(/[^a-zA-Z0-9._-]/g, '');
}

async function queryViaPostgres(sipDomain: string): Promise<RegisteredExtension[]> {
  const host = process.env.FUSIONPBX_IP;
  const user = process.env.FUSIONPBX_PG_USER || 'fusionpbx_readonly';
  const password = process.env.FUSIONPBX_PG_PASSWORD;
  const db = process.env.FUSIONPBX_PG_DB || 'fusionpbx';
  const port = parseInt(process.env.FUSIONPBX_PG_PORT || '5432', 10);
  const sslEnabled = parseBool(process.env.FUSIONPBX_PG_SSL, false);

  if (!host || !password) {
    throw Object.assign(new Error('FusionPBX PG config missing'), { code: 'PG_CONFIG_MISSING' });
  }

  const { Client } = require('pg');
  const client = new Client({
    host,
    port,
    user,
    password,
    database: db,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 5000,
    statement_timeout: 8000,
  });

  try {
    await client.connect();
    const res = await client.query(
      `SELECT sip_user AS extension, network_ip, expires
       FROM sip_registrations
       WHERE expires > EXTRACT(EPOCH FROM NOW())::bigint
         AND sip_realm = $1`,
      [sipDomain],
    );
    const rows: RegisteredExtension[] = [];
    for (const r of res.rows) {
      if (!r.extension) continue;
      rows.push({
        extension: String(r.extension).trim(),
        networkIp: String(r.network_ip || ''),
        expiresAt: r.expires ? new Date(Number(r.expires) * 1000) : null,
      });
    }
    return rows;
  } finally {
    try { await client.end(); } catch {}
  }
}

async function queryViaSsh(sipDomain: string, cluster?: { pbxIp: string; sshUser: string | null; sshPassword: string | null } | null): Promise<RegisteredExtension[]> {
  const host = cluster?.pbxIp || process.env.FUSIONPBX_IP;
  const username = cluster?.sshUser || process.env.FUSIONPBX_SSH_USER || 'root';
  const password = cluster?.sshPassword || process.env.FUSIONPBX_SSH_PASSWORD;
  if (!host) throw Object.assign(new Error('FusionPBX SSH host missing'), { code: 'SSH_CONFIG_MISSING' });

  const { Client } = require('ssh2');
  const fs = require('fs');
  const path = require('path');

  const homedir = process.env.HOME || '/home/node';
  let privateKey: Buffer | undefined;
  for (const kp of [path.join(homedir, '.ssh/id_rsa'), '/root/.ssh/id_rsa']) {
    try { if (fs.existsSync(kp)) { privateKey = fs.readFileSync(kp); break; } } catch {}
  }

  // Query FreeSWITCH's SQLite registration DBs. Softphones register to
  // internal OR external profile depending on NAT/routing (eyeBeam → internal,
  // MicroSIP via public IP → external). Query BOTH and union results.
  // Filter by sip_realm: a single PBX hosts multiple FusionPBX domains and
  // ext `105` can register under different domains — without the realm filter
  // one tenant's presence leaks into another's dashboard.
  const dbDir = process.env.FUSIONPBX_SOFIA_DB_DIR || '/var/lib/freeswitch/db';
  const internalDb = `${dbDir}/sofia_reg_internal.db`;
  const externalDb = `${dbDir}/sofia_reg_external.db`;
  const safeDomain = sanitizeDomain(sipDomain);
  const selectSql = `SELECT sip_user, COALESCE(network_ip,''), COALESCE(expires,0) FROM sip_registrations WHERE expires > strftime('%s','now') AND sip_realm='${safeDomain}'`;
  // Each sqlite3 call isolated with || true so a missing/empty external DB
  // doesn't abort the whole command.
  const sqliteCmd = `(sqlite3 -separator '|' ${internalDb} "${selectSql}" 2>/dev/null || true); (sqlite3 -separator '|' ${externalDb} "${selectSql}" 2>/dev/null || true)`;

  const conn = new Client();
  const output: string = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { conn.end(); reject(new Error('SSH timeout')); }, 15000);

    conn.on('ready', () => {
      conn.exec(sqliteCmd, (err: Error, stream: any) => {
        if (err) { clearTimeout(timeout); conn.end(); return reject(err); }
        let out = '';
        let errOut = '';
        stream.on('data', (d: Buffer) => { out += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { errOut += d.toString(); });
        stream.on('close', (code: number) => {
          clearTimeout(timeout);
          conn.end();
          if (code !== 0 && errOut) return reject(new Error(`sqlite3 exit ${code}: ${errOut.trim()}`));
          resolve(out.trim());
        });
      });
    });
    conn.on('keyboard-interactive', (_n: any, _i: any, _il: any, _p: any, finish: Function) => finish([password || '']));
    conn.on('error', (err: Error) => { clearTimeout(timeout); reject(err); });

    conn.connect({
      host, port: 22, username, password,
      privateKey, readyTimeout: 10000, tryKeyboard: true,
    });
  });

  // sqlite3 pipe-separated: sip_user|network_ip|expires (one row per line)
  const rows: RegisteredExtension[] = [];
  for (const line of output.split('\n')) {
    const parts = line.split('|');
    if (!parts[0] || !parts[0].trim()) continue;
    const expiresSec = parseInt(parts[2] || '0', 10);
    rows.push({
      extension: parts[0].trim(),
      networkIp: (parts[1] || '').trim(),
      expiresAt: expiresSec > 0 ? new Date(expiresSec * 1000) : null,
    });
  }
  return rows;
}

/** True when no FusionPBX target has been configured yet (waiting for server to be provisioned). */
async function isConfigMissing(): Promise<boolean> {
  const pgReady = !!process.env.FUSIONPBX_IP && !!process.env.FUSIONPBX_PG_PASSWORD;
  const sshEnvReady = !!(process.env.FUSIONPBX_IP || process.env.FUSIONPBX_SSH_HOST) &&
    !!process.env.FUSIONPBX_SSH_PASSWORD;
  if (pgReady || sshEnvReady) return false;

  // Fall back to the active PBX cluster's SSH credentials if present.
  try {
    const prisma = (await import('../lib/prisma')).default;
    const c = await prisma.pbxCluster.findFirst({
      where: { isActive: true },
      select: { pbxIp: true, sshPassword: true },
    });
    if (c?.pbxIp && c.sshPassword) return false;
  } catch {}
  return true;
}

export interface PresenceCluster {
  pbxIp: string;
  sipDomain: string;
  sshUser: string | null;
  sshPassword: string | null;
}

/**
 * Fetch currently registered extensions for ONE cluster from its PBX host.
 * Filters by `sip_realm = cluster.sipDomain` to avoid leaking presence across
 * tenants that share a PBX.
 *
 * Tries PostgreSQL first (when env is configured), falls back to SSH + SQLite.
 * Returns `source: 'unconfigured'` when neither path has credentials.
 */
export async function fetchRegisteredExtensions(cluster: PresenceCluster): Promise<{
  extensions: RegisteredExtension[];
  source: 'pg' | 'ssh' | 'unconfigured';
}> {
  if (!cluster.sipDomain) {
    logger.warn('SIP presence: cluster has no sipDomain, skipping', { pbxIp: cluster.pbxIp });
    return { extensions: [], source: 'unconfigured' };
  }
  if (await isConfigMissing() && !cluster.sshPassword) {
    return { extensions: [], source: 'unconfigured' };
  }
  // Try PG first only when env is fully configured AND points at this cluster's PBX host.
  if (process.env.FUSIONPBX_IP === cluster.pbxIp && process.env.FUSIONPBX_PG_PASSWORD) {
    try {
      const rows = await queryViaPostgres(cluster.sipDomain);
      return { extensions: rows, source: 'pg' };
    } catch (err) {
      const e = err as Error & { code?: string };
      logger.warn('SIP presence: PG query failed, falling back to SSH', { error: e.message, code: e.code });
    }
  }
  const rows = await queryViaSsh(cluster.sipDomain, {
    pbxIp: cluster.pbxIp,
    sshUser: cluster.sshUser,
    sshPassword: cluster.sshPassword,
  });
  return { extensions: rows, source: 'ssh' };
}
