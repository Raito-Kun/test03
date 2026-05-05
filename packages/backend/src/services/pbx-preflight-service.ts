import { Client as SshClient } from 'ssh2';
import { Client as PgClient } from 'pg';
import prisma from '../lib/prisma';
import { testConnectionEnhanced } from './network-scan-service';
import { detectRecordingActions, RECORDING_ACTION_KEYWORDS, aggregateRuleStatuses, type PerRuleResult } from '../lib/pbx-dialplan-detect';
import logger from '../lib/logger';

/**
 * Read-only preflight for a PbxCluster. Each check is independent and may skip
 * when required credentials aren't configured. Never mutates anything on the
 * FusionPBX side — all DB queries are SELECT, SSH is a single `echo ok`, and
 * the recording proxy check is a HEAD request.
 */

export type PreflightCheckKey =
  | 'esl' | 'ssh' | 'pbx_domain'
  | 'recording_dialplan' | 'webhook_ip'
  | 'recording_proxy' | 'extension_count';

export interface PreflightCheck {
  key: PreflightCheckKey;
  label: string;
  required: boolean;
  status: 'pass' | 'fail' | 'skipped' | 'warn';
  message: string;
  hint?: string;
  durationMs: number;
}

export interface PreflightResult {
  clusterId: string;
  checks: PreflightCheck[];
  allRequiredPass: boolean;
  ranAt: string;
}

const CHECK_TIMEOUT_MS = 10_000;
const LABELS: Record<PreflightCheckKey, string> = {
  esl: 'Kết nối ESL',
  ssh: 'Truy cập SSH',
  pbx_domain: 'Domain tồn tại trên PBX',
  recording_dialplan: 'Dialplan ghi âm OUT-ALL',
  webhook_ip: 'IP đã whitelist webhook CDR',
  recording_proxy: 'Proxy nghe ghi âm',
  extension_count: 'Số extension trên PBX',
};

const REQUIRED: Record<PreflightCheckKey, boolean> = {
  esl: true, ssh: true, pbx_domain: true, recording_dialplan: true, webhook_ip: true,
  recording_proxy: false, extension_count: false,
};

function timed<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout sau ${ms / 1000}s`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function runCheck(
  key: PreflightCheckKey,
  fn: () => Promise<Omit<PreflightCheck, 'key' | 'label' | 'required' | 'durationMs'>>,
): Promise<PreflightCheck> {
  const start = Date.now();
  const base = { key, label: LABELS[key], required: REQUIRED[key] };
  try {
    const out = await timed(fn(), CHECK_TIMEOUT_MS);
    return { ...base, ...out, durationMs: Date.now() - start };
  } catch (err) {
    return {
      ...base,
      status: 'fail',
      message: (err as Error).message || 'Lỗi không xác định',
      durationMs: Date.now() - start,
    };
  }
}

type ClusterRow = {
  id: string;
  pbxIp: string;
  sipDomain: string;
  eslHost: string;
  eslPort: number;
  eslPassword: string;
  sshUser: string | null;
  sshPassword: string | null;
  fusionpbxPgHost: string | null;
  fusionpbxPgPort: number | null;
  fusionpbxPgUser: string | null;
  fusionpbxPgPassword: string | null;
  fusionpbxPgDatabase: string | null;
  recordingUrlPrefix: string | null;
  outboundDialplanNames: string[];
};

async function checkEsl(c: ClusterRow) {
  const info = await testConnectionEnhanced(c.eslHost, c.eslPort, c.eslPassword);
  return { status: 'pass' as const, message: `${info.version} (${info.gateways.length} gateway, ${info.profiles.length} profile)` };
}

async function checkSsh(c: ClusterRow) {
  if (!c.sshUser || !c.sshPassword) {
    return { status: 'skipped' as const, message: 'Chưa cấu hình SSH credentials', hint: 'Điền ssh_user/ssh_password trong cluster' };
  }
  return new Promise<Omit<PreflightCheck, 'key' | 'label' | 'required' | 'durationMs'>>((resolve, reject) => {
    const conn = new SshClient();
    conn.on('ready', () => {
      conn.exec('echo ok', (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        let out = '';
        stream.on('data', (d: Buffer) => { out += d.toString(); });
        stream.on('close', () => {
          conn.end();
          resolve({ status: out.trim() === 'ok' ? 'pass' : 'fail', message: out.trim() === 'ok' ? 'SSH OK' : `SSH response unexpected: ${out}` });
        });
      });
    });
    conn.on('error', (err) => reject(new Error(`SSH: ${err.message}`)));
    conn.connect({
      host: c.pbxIp,
      port: 22,
      username: c.sshUser!,
      password: c.sshPassword!,
      tryKeyboard: true,
      readyTimeout: 6000,
    });
    conn.on('keyboard-interactive', (_n, _i, _l, _p, finish) => finish([c.sshPassword!]));
  });
}

async function pgQuery<T = unknown>(c: ClusterRow, sql: string, params: unknown[] = []): Promise<T[]> {
  if (!c.fusionpbxPgHost || !c.fusionpbxPgUser || !c.fusionpbxPgPassword || !c.fusionpbxPgDatabase) {
    throw new Error('Chưa cấu hình FusionPBX Postgres credentials');
  }
  const client = new PgClient({
    host: c.fusionpbxPgHost,
    port: c.fusionpbxPgPort || 5432,
    user: c.fusionpbxPgUser,
    password: c.fusionpbxPgPassword,
    database: c.fusionpbxPgDatabase,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const res = await client.query(sql, params);
    return res.rows as T[];
  } finally {
    await client.end().catch(() => {});
  }
}

async function checkPbxDomain(c: ClusterRow) {
  if (!c.fusionpbxPgHost) return { status: 'skipped' as const, message: 'Bỏ qua — chưa cấu hình FusionPBX PG', hint: 'Điền FusionPBX PG host/user/password/database' };
  const rows = await pgQuery<{ domain_uuid: string }>(
    c, 'SELECT domain_uuid FROM v_domains WHERE domain_name = $1 AND domain_enabled = \'true\' LIMIT 1', [c.sipDomain],
  );
  if (!rows.length) return { status: 'fail' as const, message: `Domain "${c.sipDomain}" không tồn tại trên PBX`, hint: 'Tạo domain trong FusionPBX Admin UI → Advanced → Domains' };
  return { status: 'pass' as const, message: `Domain tồn tại (${rows[0].domain_uuid.slice(0, 8)}…)` };
}

async function checkRecordingDialplan(c: ClusterRow) {
  if (!c.fusionpbxPgHost) return { status: 'skipped' as const, message: 'Bỏ qua — chưa cấu hình FusionPBX PG' };
  if (!c.outboundDialplanNames || c.outboundDialplanNames.length === 0) {
    return { status: 'skipped' as const, message: 'Chưa chọn rule nào', hint: 'Chọn ít nhất 1 dialplan rule trong tab SSH/FusionPBX PG' };
  }
  const rows = await pgQuery<{ dialplan_name: string; dialplan_xml: string | null }>(
    c,
    `SELECT d.dialplan_name, d.dialplan_xml FROM v_dialplans d
      JOIN v_domains dom ON dom.domain_uuid = d.domain_uuid
     WHERE dom.domain_name = $1 AND d.dialplan_name = ANY($2::text[]) AND d.dialplan_enabled = 'true'
     ORDER BY d.dialplan_order ASC`,
    [c.sipDomain, c.outboundDialplanNames],
  );

  const perRule: PerRuleResult[] = c.outboundDialplanNames.map((name) => {
    const xml = rows.filter((r) => r.dialplan_name === name).map((r) => r.dialplan_xml || '').join('\n');
    if (!xml) return { name, status: 'missing', missing: [...RECORDING_ACTION_KEYWORDS] };
    const det = detectRecordingActions(xml);
    return { name, status: det.ok ? 'ok' : 'partial', missing: det.missing };
  });

  const agg = aggregateRuleStatuses(perRule);
  return { status: agg.status, message: agg.message, hint: agg.hint };
}

function isPbxIpAllowed(pbxIp: string, allowedCsv: string): boolean {
  const list = allowedCsv.split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes('0.0.0.0') || list.includes(pbxIp);
}

async function checkWebhookIp(c: ClusterRow) {
  const allowed = process.env.WEBHOOK_ALLOWED_IPS || '';
  if (!allowed) return { status: 'fail' as const, message: 'WEBHOOK_ALLOWED_IPS chưa cấu hình trên backend', hint: 'Sửa .env WEBHOOK_ALLOWED_IPS và restart backend' };
  if (!isPbxIpAllowed(c.pbxIp, allowed)) return { status: 'fail' as const, message: `IP ${c.pbxIp} chưa có trong whitelist`, hint: `Thêm ${c.pbxIp} vào WEBHOOK_ALLOWED_IPS` };
  return { status: 'pass' as const, message: `IP ${c.pbxIp} đã whitelist` };
}

async function checkRecordingProxy(c: ClusterRow) {
  if (!c.recordingUrlPrefix) return { status: 'skipped' as const, message: 'Chưa cấu hình recording URL prefix' };
  try {
    const res = await fetch(c.recordingUrlPrefix, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    if ([200, 301, 302, 403, 404].includes(res.status)) return { status: 'pass' as const, message: `Proxy phản hồi HTTP ${res.status}` };
    return { status: 'warn' as const, message: `HTTP ${res.status} — có thể cần kiểm tra`, hint: 'Nginx proxy có thể cấu hình sai alias' };
  } catch (err) {
    return { status: 'warn' as const, message: `Không kết nối được: ${(err as Error).message}`, hint: 'Kiểm tra nginx trên PBX và firewall' };
  }
}

async function checkExtensionCount(c: ClusterRow) {
  if (!c.fusionpbxPgHost) return { status: 'skipped' as const, message: 'Bỏ qua — chưa cấu hình FusionPBX PG' };
  const rows = await pgQuery<{ count: string }>(
    c,
    `SELECT count(*)::text AS count FROM v_extensions e
      JOIN v_domains d ON d.domain_uuid = e.domain_uuid
     WHERE d.domain_name = $1 AND e.enabled = 'true'`,
    [c.sipDomain],
  );
  const n = Number(rows[0]?.count || '0');
  if (n === 0) return { status: 'warn' as const, message: 'Chưa có extension nào trên domain', hint: 'Tạo extensions trong FusionPBX rồi chạy sync' };
  return { status: 'pass' as const, message: `${n} extension đang hoạt động` };
}

export async function runPreflight(clusterId: string): Promise<PreflightResult> {
  const cluster = await prisma.pbxCluster.findUnique({
    where: { id: clusterId },
    select: {
      id: true, pbxIp: true, sipDomain: true,
      eslHost: true, eslPort: true, eslPassword: true,
      sshUser: true, sshPassword: true,
      fusionpbxPgHost: true, fusionpbxPgPort: true, fusionpbxPgUser: true,
      fusionpbxPgPassword: true, fusionpbxPgDatabase: true,
      recordingUrlPrefix: true,
      outboundDialplanNames: true,
    },
  });
  if (!cluster) throw Object.assign(new Error('Cluster not found'), { code: 'NOT_FOUND' });

  logger.info('Preflight start', { clusterId });
  const checks = await Promise.all([
    runCheck('esl', () => checkEsl(cluster)),
    runCheck('ssh', () => checkSsh(cluster)),
    runCheck('pbx_domain', () => checkPbxDomain(cluster)),
    runCheck('recording_dialplan', () => checkRecordingDialplan(cluster)),
    runCheck('webhook_ip', () => checkWebhookIp(cluster)),
    runCheck('recording_proxy', () => checkRecordingProxy(cluster)),
    runCheck('extension_count', () => checkExtensionCount(cluster)),
  ]);

  const allRequiredPass = checks.every((c) => !c.required || c.status === 'pass');
  logger.info('Preflight done', { clusterId, allRequiredPass, failed: checks.filter((c) => c.status === 'fail').map((c) => c.key) });

  return { clusterId, checks, allRequiredPass, ranAt: new Date().toISOString() };
}

export { isPbxIpAllowed };

/**
 * List outbound-candidate dialplan rules for a cluster's FusionPBX domain.
 * Used to populate the multi-select in cluster-detail-form. Returns only
 * enabled rules, ordered by dialplan_order (FusionPBX's match priority).
 */
export async function listClusterDialplans(clusterId: string): Promise<Array<{ name: string; order: number }>> {
  const cluster = await prisma.pbxCluster.findUnique({
    where: { id: clusterId },
    select: {
      sipDomain: true,
      fusionpbxPgHost: true, fusionpbxPgPort: true, fusionpbxPgUser: true,
      fusionpbxPgPassword: true, fusionpbxPgDatabase: true,
    },
  });
  if (!cluster) throw Object.assign(new Error('Cluster not found'), { code: 'NOT_FOUND' });
  if (!cluster.fusionpbxPgHost) throw Object.assign(new Error('Chưa cấu hình FusionPBX Postgres credentials'), { code: 'VALIDATION_ERROR' });

  const rows = await pgQuery<{ dialplan_name: string; dialplan_order: number }>(
    { ...cluster, id: clusterId, pbxIp: '', eslHost: '', eslPort: 0, eslPassword: '', sshUser: null, sshPassword: null, recordingUrlPrefix: null, outboundDialplanNames: [] } as ClusterRow,
    `SELECT DISTINCT d.dialplan_name, d.dialplan_order
       FROM v_dialplans d
       JOIN v_domains dom ON dom.domain_uuid = d.domain_uuid
      WHERE dom.domain_name = $1 AND d.dialplan_enabled = 'true'
      ORDER BY d.dialplan_order ASC, d.dialplan_name ASC`,
    [cluster.sipDomain],
  );
  return rows.map((r) => ({ name: r.dialplan_name, order: r.dialplan_order }));
}
