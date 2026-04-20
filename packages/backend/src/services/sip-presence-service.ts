/**
 * SIP presence detection from FusionPBX.
 * Primary: query FusionPBX PostgreSQL directly for active sip_registrations.
 * Fallback: SSH to FusionPBX and run fs_cli -x "show registrations as json".
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

async function queryViaPostgres(): Promise<RegisteredExtension[]> {
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
       WHERE expires > EXTRACT(EPOCH FROM NOW())::bigint`,
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

async function queryViaSsh(): Promise<RegisteredExtension[]> {
  const prisma = (await import('../lib/prisma')).default;
  const cluster = await prisma.pbxCluster.findFirst({
    where: { isActive: true },
    select: { pbxIp: true, sshUser: true, sshPassword: true },
  });

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
  const dbDir = process.env.FUSIONPBX_SOFIA_DB_DIR || '/var/lib/freeswitch/db';
  const internalDb = `${dbDir}/sofia_reg_internal.db`;
  const externalDb = `${dbDir}/sofia_reg_external.db`;
  const selectSql = `SELECT sip_user, COALESCE(network_ip,''), COALESCE(expires,0) FROM sip_registrations WHERE expires > strftime('%s','now')`;
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

/**
 * Fetch currently registered extensions from FusionPBX.
 * Tries PostgreSQL first, falls back to SSH + fs_cli.
 * Returns `source: 'unconfigured'` when FusionPBX credentials are not set yet.
 */
export async function fetchRegisteredExtensions(): Promise<{
  extensions: RegisteredExtension[];
  source: 'pg' | 'ssh' | 'unconfigured';
}> {
  if (await isConfigMissing()) {
    return { extensions: [], source: 'unconfigured' };
  }
  // Try PG first only when env is fully configured (no cluster-level PG creds exist).
  if (process.env.FUSIONPBX_IP && process.env.FUSIONPBX_PG_PASSWORD) {
    try {
      const rows = await queryViaPostgres();
      return { extensions: rows, source: 'pg' };
    } catch (err) {
      const e = err as Error & { code?: string };
      logger.warn('SIP presence: PG query failed, falling back to SSH', { error: e.message, code: e.code });
    }
  }
  const rows = await queryViaSsh();
  return { extensions: rows, source: 'ssh' };
}
