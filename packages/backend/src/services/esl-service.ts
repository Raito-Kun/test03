import eslDaemon from '../lib/esl-daemon';
import logger from '../lib/logger';
import { getAgentStatus, setAgentStatus, startWrapUpTimer, cancelWrapUpTimer } from './agent-status-service';
import prisma from '../lib/prisma';
import { emitToUser } from '../lib/socket-io';

/** Strict whitelist: digits, +, *, #, max 30 chars */
const ESL_SAFE_RE = /^[0-9+*#]{1,30}$/;

export function sanitizeEslInput(value: string): string {
  if (!ESL_SAFE_RE.test(value)) {
    throw Object.assign(new Error('Invalid ESL input: unsafe characters'), { code: 'VALIDATION_ERROR' });
  }
  return value;
}

function sendBgapi(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = eslDaemon.getConnection();
    if (!conn) {
      return reject(Object.assign(new Error('ESL not connected'), { code: 'ESL_UNAVAILABLE' }));
    }
    try {
      conn.bgapi(command, (_evt: unknown) => {
        resolve();
      });
    } catch (err: unknown) {
      const e = err as Error;
      logger.error('ESL bgapi error', { command, error: e.message });
      reject(err);
    }
  });
}

/**
 * Click-to-Call: ring agent's phone first, when answered bridge to customer.
 * Flow: CRM → ESL originate → FusionPBX rings agent (Eyebeam) → agent answers → bridge to customer
 *
 * Always routes via loopback through FusionPBX domain dialplan so outbound
 * routes, caller-ID rules, and gateway selection are handled by FusionPBX.
 */
export async function originate(
  agentExtension: string,
  destinationNumber: string,
  callerId: string,
  userId: string,
): Promise<void> {
  // Check agent is not on break/offline
  const blockedStatuses = ['break', 'offline'];
  const agentStatus = await getAgentStatus(userId);
  if (blockedStatuses.includes(agentStatus.status)) {
    throw Object.assign(
      new Error('Bạn cần chuyển sang trạng thái Sẵn sàng để thực hiện cuộc gọi'),
      { code: 'AGENT_NOT_READY' },
    );
  }

  // ESL must be connected before we attempt to originate
  if (!eslDaemon.getConnection()) {
    throw Object.assign(
      new Error('Tổng đài không phản hồi (ESL không kết nối). Vui lòng liên hệ quản trị viên.'),
      { code: 'ESL_UNAVAILABLE' },
    );
  }

  // Extension must be registered on FusionPBX
  const regs = await getSofiaRegistrations();
  if (!regs.has(agentExtension) || regs.get(agentExtension) !== 'Registered') {
    throw Object.assign(
      new Error(`Extension ${agentExtension} chưa đăng ký trên tổng đài. Vui lòng mở softphone và đăng nhập.`),
      { code: 'EXT_NOT_REGISTERED' },
    );
  }

  const ext = sanitizeEslInput(agentExtension);
  const dest = sanitizeEslInput(destinationNumber);
  const cid = sanitizeEslInput(callerId);

  // Prefer active cluster's SIP domain over the env fallback
  const activeCluster = await prisma.pbxCluster.findFirst({ where: { isActive: true }, select: { sipDomain: true } });
  const domain = activeCluster?.sipDomain || process.env.FUSIONPBX_DOMAIN || 'crm';

  // Bridge via loopback → FusionPBX outbound dialplan.
  // FreeSWITCH parses commas inside {} so export_vars must list a single name.
  // Set crm_user_id / crm_call_source on BOTH the originate leg and the bridge leg
  // so the CDR webhook sees them regardless of which leg it processes.
  // record_session=true tells the FusionPBX outbound dialplan to record this call
  // (the blueva dialplan tests `${record_session} =~ /^true$/` then triggers record_session).
  const ctx = `crm_user_id=${userId},crm_call_source=c2c,record_session=true`;
  const cmd = `originate {ignore_early_media=true,origination_caller_id_number=${cid},origination_caller_id_name=CRM,originate_timeout=30,${ctx}}user/${ext}@${domain} &bridge({${ctx}}loopback/${dest}/${domain})`;
  logger.info('C2C originate', { cmd, agentExt: ext, destination: dest, domain });
  await sendBgapi(cmd);
}

function sendApi(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = eslDaemon.getConnection();
    if (!conn) return reject(Object.assign(new Error('ESL not connected'), { code: 'ESL_UNAVAILABLE' }));
    try {
      conn.api(command, (evt: { getBody(): string }) => {
        resolve(evt.getBody() || '');
      });
    } catch (err) { reject(err); }
  });
}

export interface RegistrationStatus {
  extension: string | null;
  registered: boolean;
  eslAvailable: boolean;
}

/** Lookup registration state for a single extension. Distinguishes ESL-down from ext-not-registered. */
export async function getRegistrationStatus(extension: string | null | undefined): Promise<RegistrationStatus> {
  if (!extension) return { extension: null, registered: false, eslAvailable: false };
  if (!eslDaemon.getConnection()) return { extension, registered: false, eslAvailable: false };
  try {
    const regs = await getSofiaRegistrations();
    return { extension, registered: regs.get(extension) === 'Registered', eslAvailable: true };
  } catch {
    return { extension, registered: false, eslAvailable: false };
  }
}

export async function getSofiaRegistrations(): Promise<Map<string, string>> {
  // Softphones may register to either profile (NAT softphones → external,
  // LAN softphones → internal). Query both, union results; a "Registered"
  // status on EITHER profile wins.
  const profiles = ['internal', 'external'] as const;
  const regs = new Map<string, string>();

  for (const profile of profiles) {
    let body: string;
    try {
      body = await sendApi(`sofia status profile ${profile} reg`);
    } catch {
      continue; // ESL down or profile missing → skip this profile
    }
    // Output: "User:\t101@blueva" then later "Status:\tRegistered(UDP)(unknown)"
    let currentExt = '';
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      const userMatch = trimmed.match(/^User:\s+(\d+)@/);
      if (userMatch) {
        currentExt = userMatch[1];
      }
      const statusMatch = trimmed.match(/^Status:\s+(.+)/);
      if (statusMatch && currentExt) {
        const isRegistered = statusMatch[1].toLowerCase().startsWith('registered');
        // Don't demote "Registered" on one profile with "Unregistered" on another
        if (!(regs.get(currentExt) === 'Registered' && !isRegistered)) {
          regs.set(currentExt, isRegistered ? 'Registered' : 'Unregistered');
        }
        currentExt = '';
      }
    }
  }
  return regs;
}

/** Hangup a call by UUID */
export async function hangup(callUuid: string): Promise<void> {
  if (!/^[0-9a-f-]{32,36}$/i.test(callUuid)) {
    throw Object.assign(new Error('Invalid call UUID'), { code: 'VALIDATION_ERROR' });
  }
  await sendBgapi(`uuid_kill ${callUuid}`);
}

/** Place a call on hold */
export async function hold(callUuid: string): Promise<void> {
  if (!/^[0-9a-f-]{32,36}$/i.test(callUuid)) {
    throw Object.assign(new Error('Invalid call UUID'), { code: 'VALIDATION_ERROR' });
  }
  await sendBgapi(`uuid_hold ${callUuid}`);
}

/** Transfer a call to target extension */
export async function transfer(callUuid: string, targetExtension: string): Promise<void> {
  if (!/^[0-9a-f-]{32,36}$/i.test(callUuid)) {
    throw Object.assign(new Error('Invalid call UUID'), { code: 'VALIDATION_ERROR' });
  }
  const target = sanitizeEslInput(targetExtension);
  await sendBgapi(`uuid_transfer ${callUuid} ${target} XML default`);
}

/**
 * Wire ESL daemon events to agent status changes.
 * Call once at startup after Socket.IO is initialized.
 */
export function wireEslAgentStatus(): void {
  eslDaemon.on('call:ringing', async ({ uuid, direction, contactPhone }: { uuid: string; direction: string; contactPhone: string }) => {
    try {
      // Try to resolve agent extension from current call state in Redis
      const { default: redis } = await import('../lib/redis');
      const raw = await redis.get(`call:${uuid}`);
      if (!raw) return;
      const call = JSON.parse(raw) as { agentId?: string };

      // Look up user by caller number (agent extension for outbound, dest for inbound)
      const agentId = call.agentId;
      if (agentId) {
        await cancelWrapUpTimer(agentId);
        await setAgentStatus(agentId, 'ringing', 'esl_channel_create');
        emitToUser(agentId, 'call:state', { state: 'ringing', uuid, direction, contactPhone });
        logger.info('Agent status → ringing', { agentId, uuid });
      }
    } catch (e) {
      logger.error('wireEslAgentStatus ringing error', { error: (e as Error).message });
    }
  });

  eslDaemon.on('call:answered', async ({ uuid }: { uuid: string }) => {
    try {
      const { default: redis } = await import('../lib/redis');
      const raw = await redis.get(`call:${uuid}`);
      if (!raw) return;
      const call = JSON.parse(raw) as { agentId?: string };
      if (call.agentId) {
        await cancelWrapUpTimer(call.agentId);
        await setAgentStatus(call.agentId, 'on_call', 'esl_channel_answer');
        emitToUser(call.agentId, 'call:state', { state: 'on_call', uuid });
        logger.info('Agent status → on_call', { agentId: call.agentId, uuid });
      }
    } catch (e) {
      logger.error('wireEslAgentStatus answered error', { error: (e as Error).message });
    }
  });

  eslDaemon.on('call:ended', async ({ uuid }: { uuid: string }) => {
    try {
      // We need extension → agentId mapping. Query DB by checking who had this call.
      // Since call data is deleted from Redis on hangup, we look up from DB callLogs.
      const callLog = await prisma.callLog.findFirst({
        where: { callUuid: uuid },
        select: { userId: true },
      });
      const agentId = callLog?.userId;
      if (agentId) {
        await setAgentStatus(agentId, 'wrap_up', 'esl_channel_hangup');
        await startWrapUpTimer(agentId);
        emitToUser(agentId, 'call:state', { state: 'wrap_up', uuid });
        logger.info('Agent status → wrap_up', { agentId, uuid });
      }
    } catch (e) {
      logger.error('wireEslAgentStatus ended error', { error: (e as Error).message });
    }
  });
}

/** Attended transfer: bridge current call to a new leg, then transfer when target answers */
export async function attendedTransfer(callUuid: string, targetExtension: string): Promise<void> {
  if (!/^[0-9a-f-]{32,36}$/i.test(callUuid)) {
    throw Object.assign(new Error('Invalid call UUID'), { code: 'VALIDATION_ERROR' });
  }
  const target = sanitizeEslInput(targetExtension);
  const domain = process.env.FUSIONPBX_DOMAIN || 'crm';
  // att_xfer: put current call on hold, call target extension, when answered bridge them
  await sendBgapi(`uuid_broadcast ${callUuid} att_xfer::user/${target}@${domain} aleg`);
}
