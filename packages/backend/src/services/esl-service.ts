import eslDaemon from '../lib/esl-daemon';
import logger from '../lib/logger';

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
 * Flow: CRM → ESL originate → FusionPBX rings agent → agent answers → bridge to customer
 */
export async function originate(
  agentExtension: string,
  destinationNumber: string,
  callerId: string,
): Promise<void> {
  const ext = sanitizeEslInput(agentExtension);
  const dest = sanitizeEslInput(destinationNumber);
  const cid = sanitizeEslInput(callerId);

  const domain = process.env.FUSIONPBX_DOMAIN || process.env.ESL_HOST || '127.0.0.1';
  // C2C: call agent extension on FusionPBX domain, then bridge to customer
  const cmd = `originate {origination_caller_id_number=${cid},origination_caller_id_name=CRM}user/${ext}@${domain} &bridge(sofia/internal/${dest}@${domain})`;
  logger.info('C2C originate', { agentExt: ext, destination: dest, domain });
  await sendBgapi(cmd);
}

/** Hangup a call by UUID */
export async function hangup(callUuid: string): Promise<void> {
  const uuid = sanitizeEslInput(callUuid.replace(/-/g, '')); // allow dashes in UUID
  // re-validate with UUID-safe pattern
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
