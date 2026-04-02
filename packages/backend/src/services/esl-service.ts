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

  // Check extension is registered in FusionPBX (if ESL available)
  const regs = await getSofiaRegistrations();
  if (regs.size > 0 && !regs.has(agentExtension)) {
    // ESL is reachable and extension is NOT registered
    throw Object.assign(
      new Error(`Extension ${agentExtension} chưa đăng nhập. Vui lòng mở Eyebeam và đăng nhập.`),
      { code: 'EXT_NOT_REGISTERED' },
    );
  }
  // If regs.size === 0 → ESL unreachable, allow call anyway

  const ext = sanitizeEslInput(agentExtension);
  const dest = sanitizeEslInput(destinationNumber);
  const cid = sanitizeEslInput(callerId);

  const domain = process.env.FUSIONPBX_DOMAIN || 'crm';

  // Bridge via loopback → FusionPBX outbound dialplan for domain 'crm'
  // export crm_call_source so it propagates through loopback/bridge legs
  const cmd = `originate {ignore_early_media=true,origination_caller_id_number=${cid},origination_caller_id_name=CRM,originate_timeout=30,crm_call_source=c2c,export_vars=crm_call_source}user/${ext}@${domain} &bridge(loopback/${dest}/${domain})`;
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

export async function getSofiaRegistrations(): Promise<Map<string, string>> {
  try {
    const body = await sendApi('sofia status profile internal reg');
    const regs = new Map<string, string>();
    // Output is key-value pairs per registration block separated by blank lines
    // Format: "User:\t1005@crm" and "Status:\tRegistered(UDP)(unknown)"
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
        regs.set(currentExt, isRegistered ? 'Registered' : 'Unregistered');
        currentExt = '';
      }
    }
    return regs;
  } catch {
    return new Map(); // ESL unreachable → return empty (calls still allowed)
  }
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
