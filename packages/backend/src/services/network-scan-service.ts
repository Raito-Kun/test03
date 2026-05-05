import { Client } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';

export interface SshDiscoverInput {
  sshHost: string;
  sshPort?: number;
  sshUser?: string;
  sshPassword: string;
}

export interface GatewayInfo {
  name: string;
  uuid: string;
  profile: string;
  sipUri: string;
  status: string;
}

export interface RouteInfo {
  name: string;
  number: string;
}

export interface DomainDetail {
  name: string;
  outboundRoutes: RouteInfo[];
  inboundRoutes: RouteInfo[];
}

export interface ProfileInfo {
  name: string;
  type: string;
  uri: string;
}

export interface SshDiscoverResult {
  eslHost: string;
  eslPort: number;
  eslPassword: string;
  pbxIp: string;
  domainDetails: DomainDetail[];
  gateways: GatewayInfo[];
  profiles: ProfileInfo[];
  sipWssUrl: string;
  version: string;
}

/** Execute SSH command, return stdout */
function sshExec(conn: Client, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      stream.on('data', (d: Buffer) => { stdout += d.toString(); });
      stream.stderr.on('data', () => {});
      stream.on('close', () => resolve(stdout.trim()));
    });
  });
}

/** Helper: run psql via sudo -u postgres */
function psql(conn: Client, sql: string): Promise<string> {
  return sshExec(conn, `sudo -u postgres psql -d fusionpbx -t -c "${sql}" 2>/dev/null || echo ""`);
}

/** Clean psql output rows */
function cleanRows(raw: string): string[] {
  return raw.split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('(') && !l.includes('ERROR') && !l.includes('FATAL') && !l.includes('rows)'));
}

/** Parse event_socket.conf.xml */
function parseEslConf(xml: string): { port: number; password: string } {
  const portMatch = xml.match(/name="listen-port"\s+value="(\d+)"/);
  const passMatch = xml.match(/name="password"\s+value="([^"]+)"/);
  return {
    port: portMatch ? parseInt(portMatch[1], 10) : 8021,
    password: passMatch ? passMatch[1] : 'ClueCon',
  };
}

/** Parse `sofia status gateway` — tab-separated */
function parseGateways(output: string): GatewayInfo[] {
  const gateways: GatewayInfo[] = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('=') || trimmed.startsWith('---')) continue;
    if (trimmed.startsWith('Profile::') || trimmed.includes('Gateway-Name')) continue;
    if (/^\d+\s+(gateways|\()/.test(trimmed)) continue;

    const gwMatch = trimmed.match(/^(\w[\w-]*)::(\S+)/);
    if (!gwMatch) continue;

    const profile = gwMatch[1];
    const uuid = gwMatch[2];
    const rest = trimmed.slice(gwMatch[0].length).trim();
    const fields = rest.split(/\t+/).map((f) => f.trim()).filter(Boolean);
    const sipUri = fields[0] || '';
    const state = fields[1] || '';
    const nameMatch = sipUri.match(/sip:([^@]+)@/);

    gateways.push({
      name: nameMatch ? nameMatch[1] : uuid,
      uuid, profile, sipUri, status: state,
    });
  }
  return gateways;
}

/** Parse `sofia status` for SIP profiles — tab-separated */
function parseProfiles(output: string): ProfileInfo[] {
  const profiles: ProfileInfo[] = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('=') || trimmed.startsWith('---') || trimmed.startsWith('Name')) continue;
    if (trimmed.includes('::') || /^\d+\s+profile/.test(trimmed)) continue;

    const fields = trimmed.split(/\t+/).map((f) => f.trim()).filter(Boolean);
    if (fields.length >= 3 && fields[1] === 'profile' && fields[2].startsWith('sip:')) {
      const name = fields[0];
      if (name.includes('ipv6')) continue;
      let type = 'other';
      if (name.toLowerCase().includes('internal')) type = 'internal';
      else if (name.toLowerCase().includes('external')) type = 'external';
      profiles.push({ name, type, uri: fields[2] });
    }
  }
  return profiles;
}

/** Discover domains with per-domain routes from FusionPBX DB */
async function discoverDomainDetails(conn: Client, fsCliCmd: string): Promise<DomainDetail[]> {
  // Get domain list
  const domainRaw = await psql(conn, "SELECT domain_name FROM v_domains WHERE domain_enabled='true' ORDER BY domain_name;");
  const domainNames = cleanRows(domainRaw);

  if (domainNames.length === 0) {
    // Fallback: fs_cli global_getvar
    const globalVar = await sshExec(conn, `${fsCliCmd} -x 'global_getvar domain' 2>/dev/null || echo ""`);
    if (globalVar && !globalVar.startsWith('-ERR')) {
      return [{ name: globalVar.trim(), outboundRoutes: [], inboundRoutes: [] }];
    }
    return [];
  }

  // For each domain, query outbound + inbound routes in one batch
  const details: DomainDetail[] = [];
  for (const domain of domainNames) {
    // Outbound: non-public context, exclude all known system routes
    const outRaw = await psql(conn,
      `SELECT dialplan_name FROM v_dialplans WHERE domain_uuid=(SELECT domain_uuid FROM v_domains WHERE domain_name='${domain}') AND dialplan_context NOT LIKE '%public%' AND dialplan_enabled='true' AND dialplan_name NOT IN ('call_direction-outbound','default_hold_music','domain-variables','eavesdrop','group-intercept','intercept-ext','number_queue','operator-forward','page-extension','recordings','ring-group-forward','local_extension','CF','CF_registered','extension-intercom','att_xfer','tone_stream') ORDER BY dialplan_name;`,
    );
    const outRoutes = cleanRows(outRaw).map((n) => ({ name: n, number: '' }));

    // Inbound: public context
    const inRaw = await psql(conn,
      `SELECT dialplan_name || '|' || COALESCE(dialplan_number,'') FROM v_dialplans WHERE domain_uuid=(SELECT domain_uuid FROM v_domains WHERE domain_name='${domain}') AND dialplan_context='public' AND dialplan_enabled='true' ORDER BY dialplan_name;`,
    );
    const inRoutes = cleanRows(inRaw).map((row) => {
      const [name, number] = row.split('|');
      return { name: name?.trim() || '', number: number?.trim() || '' };
    });

    details.push({ name: domain, outboundRoutes: outRoutes, inboundRoutes: inRoutes });
  }

  return details;
}

/** Load host SSH private key */
function loadHostKey(): Buffer | undefined {
  const homedir = process.env.HOME || '/home/node';
  for (const kp of [
    path.join(homedir, '.ssh/id_rsa'),
    path.join(homedir, '.ssh/id_ed25519'),
    '/root/.ssh/id_rsa',
  ]) {
    try { if (fs.existsSync(kp)) return fs.readFileSync(kp); } catch {}
  }
  return undefined;
}

/** SSH into FusionPBX and discover PBX configuration */
export async function sshDiscover(input: SshDiscoverInput): Promise<SshDiscoverResult> {
  const { sshHost, sshPort = 22, sshUser = 'root', sshPassword } = input;
  const conn = new Client();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      conn.end();
      reject(Object.assign(new Error(`SSH timeout kết nối tới ${sshHost}`), { code: 'VALIDATION_ERROR' }));
    }, 30000);

    conn.on('ready', async () => {
      try {
        await sshExec(conn, 'echo connected');

        const fsCli = await sshExec(conn, 'which fs_cli 2>/dev/null || echo "fs_cli"');
        const fsCliCmd = fsCli.split('\n')[0].trim() || 'fs_cli';

        const [eslConfOutput, gatewayOutput, profileOutput, versionOutput] = await Promise.all([
          sshExec(conn, 'cat /etc/freeswitch/autoload_configs/event_socket.conf.xml 2>/dev/null || echo ""'),
          sshExec(conn, `${fsCliCmd} -x 'sofia status gateway' 2>/dev/null || echo ''`),
          sshExec(conn, `${fsCliCmd} -x 'sofia status' 2>/dev/null || echo ''`),
          sshExec(conn, `${fsCliCmd} -x 'version' 2>/dev/null || echo 'unknown'`),
        ]);

        // Domain + per-domain routes from FusionPBX DB
        const domainDetails = await discoverDomainDetails(conn, fsCliCmd);

        clearTimeout(timeout);
        conn.end();

        const eslConf = parseEslConf(eslConfOutput);

        resolve({
          eslHost: sshHost,
          eslPort: eslConf.port,
          eslPassword: eslConf.password,
          pbxIp: sshHost,
          domainDetails,
          gateways: parseGateways(gatewayOutput),
          profiles: parseProfiles(profileOutput),
          sipWssUrl: `wss://${sshHost}:7443`,
          version: versionOutput.split('\n')[0].trim() || 'unknown',
        });
      } catch (err) {
        clearTimeout(timeout);
        conn.end();
        reject(Object.assign(new Error(`Lỗi khi lấy thông tin: ${(err as Error).message}`), { code: 'VALIDATION_ERROR' }));
      }
    });

    conn.on('keyboard-interactive', (_n, _i, _il, _p, finish) => finish([sshPassword]));
    conn.on('error', (err) => {
      clearTimeout(timeout);
      reject(Object.assign(new Error(`SSH kết nối thất bại: ${err.message}`), { code: 'VALIDATION_ERROR' }));
    });

    conn.connect({
      host: sshHost, port: sshPort, username: sshUser,
      password: sshPassword, privateKey: loadHostKey(),
      readyTimeout: 10000, tryKeyboard: true,
    });
  });
}

/** Pre-check ESL: raw TCP to detect "Access Denied" before modesl hangs */
function preCheckEsl(host: string, port: number): Promise<void> {
  const net = require('net');
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.setTimeout(3000);
    sock.once('connect', () => {
      sock.once('data', (d: Buffer) => {
        const msg = d.toString();
        sock.destroy();
        if (msg.includes('Access Denied') || msg.includes('rude-rejection')) {
          reject(Object.assign(
            new Error(`ESL từ chối kết nối từ IP CRM server. Cần thêm IP CRM vào ACL trong event_socket.conf.xml trên ${host}`),
            { code: 'VALIDATION_ERROR' },
          ));
        } else {
          resolve();
        }
      });
    });
    sock.once('timeout', () => { sock.destroy(); resolve(); }); // Let modesl handle timeout
    sock.once('error', (e: Error) => {
      sock.destroy();
      reject(Object.assign(new Error(`Không thể kết nối tới ${host}:${port} — ${e.message}`), { code: 'VALIDATION_ERROR' }));
    });
    sock.connect(port, host);
  });
}

/** ESL test: connect and return version, gateways, profiles (no DB access) */
export async function testConnectionEnhanced(
  host: string, port: number, password: string,
): Promise<{ message: string; version: string; domains: string[]; gateways: GatewayInfo[]; profiles: ProfileInfo[] }> {
  // Pre-check for ACL rejection
  await preCheckEsl(host, port);

  const esl = require('modesl');

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`Timeout kết nối ESL tới ${host}:${port} — kiểm tra ESL password`), { code: 'VALIDATION_ERROR' }));
    }, 8000);

    try {
      const conn = new esl.Connection(host, port, password, async () => {
        clearTimeout(timer);
        try {
          const version = await new Promise<string>((r) => conn.api('version', (e: any) => r(e?.body?.trim() || 'unknown')));

          const domainRaw = await new Promise<string>((r) => conn.api('global_getvar domain', (e: any) => r(e?.body?.trim() || '')));
          const domains = domainRaw && !domainRaw.startsWith('-ERR') ? [domainRaw] : [];

          const gwRaw = await new Promise<string>((r) => conn.api('sofia status gateway', (e: any) => r(e?.body?.trim() || '')));
          const pfRaw = await new Promise<string>((r) => conn.api('sofia status', (e: any) => r(e?.body?.trim() || '')));

          conn.disconnect?.();
          resolve({ message: `Kết nối thành công - ${version}`, version, domains, gateways: parseGateways(gwRaw), profiles: parseProfiles(pfRaw) });
        } catch {
          conn.disconnect?.();
          resolve({ message: 'Kết nối thành công', version: 'unknown', domains: [], gateways: [], profiles: [] });
        }
      });
      conn.on('error', (err: Error) => { clearTimeout(timer); reject(Object.assign(new Error(`Không thể kết nối ESL: ${err.message}`), { code: 'VALIDATION_ERROR' })); });
    } catch (err) { clearTimeout(timer); reject(Object.assign(new Error(`Lỗi kết nối ESL: ${(err as Error).message}`), { code: 'VALIDATION_ERROR' })); }
  });
}
