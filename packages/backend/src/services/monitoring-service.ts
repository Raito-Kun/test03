import eslDaemon from '../lib/esl-daemon';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

/** Send ESL API command and return body */
function eslApi(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = eslDaemon.getConnection();
    if (!conn) return reject(Object.assign(new Error('ESL not connected'), { code: 'ESL_UNAVAILABLE' }));
    try {
      conn.api(command, (evt: { getBody(): string }) => resolve(evt.getBody() || ''));
    } catch (err) { reject(err); }
  });
}

interface ActiveCall {
  uuid: string;
  callerNumber: string;
  destNumber: string;
  duration: number;
  agentExtension: string;
  agentName: string;
  direction: string;
}

/** Get currently active calls from FreeSWITCH */
export async function getActiveCalls(): Promise<ActiveCall[]> {
  try {
    const body = await eslApi('show channels as json');
    const parsed = JSON.parse(body);
    const rows = parsed.rows || [];

    // Map extensions to agent names
    const agents = await prisma.user.findMany({
      where: { sipExtension: { not: null }, status: 'active' },
      select: { sipExtension: true, fullName: true },
    });
    const extMap = new Map(agents.map((a) => [a.sipExtension, a.fullName]));

    const calls: ActiveCall[] = [];
    for (const ch of rows) {
      // Skip non-call channels
      if (!ch.uuid || ch.callstate === 'DOWN') continue;

      const callerNum = ch.cid_num || ch.caller_id_number || '';
      const destNum = ch.dest || ch.callee_id_number || '';
      const created = ch.created_epoch ? parseInt(ch.created_epoch, 10) : 0;
      const duration = created ? Math.floor(Date.now() / 1000) - created : 0;

      // Determine agent extension
      const ext = callerNum.length <= 4 ? callerNum : (destNum.length <= 4 ? destNum : '');

      calls.push({
        uuid: ch.uuid,
        callerNumber: callerNum,
        destNumber: destNum,
        duration,
        agentExtension: ext,
        agentName: extMap.get(ext) || '',
        direction: ch.direction || 'outbound',
      });
    }

    return calls;
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'ESL_UNAVAILABLE') return [];
    logger.error('Failed to get active calls', { error: e.message });
    return [];
  }
}

interface AgentMonitor {
  id: string;
  fullName: string;
  extension: string;
  registered: boolean;
  status: string; // from Redis agent status cache
  teamId: string | null;
  teamName: string | null;
}

/** Get all agents with registration + status info */
export async function getAgentStatuses(teamId?: string): Promise<AgentMonitor[]> {
  const where: Record<string, unknown> = {
    sipExtension: { not: null },
    status: 'active',
    role: { in: ['agent_telesale', 'agent_collection', 'leader'] },
  };
  if (teamId) where.teamId = teamId;

  const agents = await prisma.user.findMany({
    where,
    select: { id: true, fullName: true, sipExtension: true, teamId: true, team: { select: { name: true } } },
  });

  // Get registrations from FreeSWITCH
  const { getSofiaRegistrations } = await import('./esl-service');
  const regs = await getSofiaRegistrations();

  return agents.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    extension: a.sipExtension || '',
    registered: regs.has(a.sipExtension || ''),
    status: regs.has(a.sipExtension || '') ? 'online' : 'offline',
    teamId: a.teamId,
    teamName: a.team?.name || null,
  }));
}

/** Whisper to agent: manager speaks to agent only, customer cannot hear */
export async function whisperToAgent(callUuid: string, managerExtension: string): Promise<void> {
  // Use eavesdrop with whisper flag — manager hears both sides, speaks to agent only
  const domain = process.env.FUSIONPBX_DOMAIN || 'crm';
  const cmd = `originate user/${managerExtension}@${domain} &eavesdrop(${callUuid})`;
  logger.info('Whisper initiated', { callUuid, managerExtension });

  const conn = eslDaemon.getConnection();
  if (!conn) throw Object.assign(new Error('ESL not connected'), { code: 'ESL_UNAVAILABLE' });

  return new Promise((resolve, reject) => {
    try {
      // Set eavesdrop to whisper mode before originating
      conn.api(`uuid_setvar ${callUuid} eavesdrop_whisper_aleg true`, () => {
        conn.bgapi(cmd, () => resolve());
      });
    } catch (err) { reject(err); }
  });
}
