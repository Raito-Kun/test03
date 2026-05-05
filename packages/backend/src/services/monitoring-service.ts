import eslDaemon from '../lib/esl-daemon';
import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { resolveListClusterFilter } from '../lib/active-cluster';

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

/**
 * Get currently active calls from FreeSWITCH (deduplicated by call_uuid).
 *
 * Cluster-aware: a single PBX can host multiple FusionPBX domains (e.g.
 * 10.10.101.206 runs both `blueva` and `hoangthienfinance.vn`). `show channels`
 * returns channels across ALL domains on that instance. Without domain
 * filtering, one tenant sees the other tenant's live calls — the live-call
 * twin of the 2026-04-17 CDR cross-tenant leak.
 *
 * We filter channels by the caller's cluster `sipDomain` using the FusionPBX
 * `context` (set to domain name) and the `presence_id` (`ext@domain`).
 */
export async function getActiveCalls(userClusterId?: string | null, userRole?: string): Promise<ActiveCall[]> {
  try {
    const clusterId = await resolveListClusterFilter(userRole, userClusterId);
    if (!clusterId) return [];

    const cluster = await prisma.pbxCluster.findUnique({
      where: { id: clusterId },
      select: { sipDomain: true },
    });
    if (!cluster) return [];
    const domain = cluster.sipDomain;

    const body = await eslApi('show channels as json');
    const parsed = JSON.parse(body);
    const rows = parsed.rows || [];

    // Map extensions to agent names — scoped to this cluster only
    const agents = await prisma.user.findMany({
      where: {
        clusterId,
        status: 'active',
        OR: [{ sipExtension: { not: null } }, { extension: { not: null } }],
      },
      select: { sipExtension: true, extension: true, fullName: true },
    });
    const extMap = new Map<string, string>();
    for (const a of agents) {
      const ext = a.extension ?? a.sipExtension;
      if (ext) extMap.set(ext, a.fullName);
    }
    const knownExtensions = new Set(extMap.keys());

    // Group channels by call_uuid to deduplicate A-leg, B-leg, loopback legs
    const callMap = new Map<string, {
      uuid: string;
      agentExt: string;
      customerNumber: string;
      direction: string;
      created: number;
    }>();

    for (const ch of rows) {
      if (!ch.uuid || ch.callstate === 'DOWN') continue;

      // Domain filter: drop channels that don't belong to this cluster's
      // FusionPBX domain. FusionPBX sets `context` = domain_name on most legs,
      // and `presence_id` = ext@domain on user-registered legs. We accept a
      // channel only if we can confirm its domain matches.
      const ctx = String(ch.context || '');
      const presence = String(ch.presence_id || '');
      const presenceDomain = presence.includes('@') ? presence.split('@')[1] : '';
      const chDomain = presenceDomain || ctx;
      if (chDomain && chDomain !== domain) continue;

      const callUuid = ch.call_uuid || ch.uuid;
      const callerNum = ch.cid_num || ch.caller_id_number || '';
      const destNum = ch.dest || ch.callee_id_number || '';
      const created = ch.created_epoch ? parseInt(ch.created_epoch, 10) : 0;

      // Identify which number is the agent extension and which is the customer
      const callerIsExt = callerNum.length <= 4 && knownExtensions.has(callerNum);
      const destIsExt = destNum.length <= 4 && knownExtensions.has(destNum);

      let agentExt = '';
      let customerNumber = '';

      if (callerIsExt) {
        agentExt = callerNum;
        customerNumber = destNum;
      } else if (destIsExt) {
        agentExt = destNum;
        customerNumber = callerNum;
      } else {
        // Fallback: shorter number is likely the extension
        agentExt = callerNum.length <= 4 ? callerNum : (destNum.length <= 4 ? destNum : '');
        customerNumber = agentExt === callerNum ? destNum : callerNum;
      }

      // Skip loopback/internal legs with no useful info
      if (!agentExt && !customerNumber) continue;

      const existing = callMap.get(callUuid);
      // Keep the leg that has the best agent extension match
      if (!existing || (agentExt && !existing.agentExt) || (agentExt && customerNumber.length > 4)) {
        callMap.set(callUuid, {
          uuid: ch.uuid,
          agentExt,
          customerNumber,
          direction: ch.direction || 'outbound',
          created,
        });
      }
    }

    // Build deduplicated call list
    const calls: ActiveCall[] = [];
    for (const [, call] of callMap) {
      const duration = call.created ? Math.floor(Date.now() / 1000) - call.created : 0;
      calls.push({
        uuid: call.uuid,
        callerNumber: call.customerNumber,
        destNumber: call.customerNumber,
        duration,
        agentExtension: call.agentExt,
        agentName: extMap.get(call.agentExt) || '',
        direction: call.direction,
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
  status: string;
  teamId: string | null;
  teamName: string | null;
  teamLeader: string | null;
}

/**
 * Get all extensions for the user's cluster with ESL registration status.
 * Shows ALL synced extensions, matched to users if assigned.
 */
export async function getAgentStatuses(teamId?: string, userClusterId?: string | null, userRole?: string): Promise<AgentMonitor[]> {
  const { resolveListClusterFilter } = await import('../lib/active-cluster');
  const clusterId = await resolveListClusterFilter(userRole, userClusterId);
  if (!clusterId) return [];
  const activeCluster = { id: clusterId };

  // Get all synced extensions for this cluster (with cached presence state)
  const clusterExts = await prisma.clusterExtension.findMany({
    where: { clusterId: activeCluster.id },
    select: { extension: true, callerName: true, sipRegistered: true },
    orderBy: { extension: 'asc' },
  });

  // Role-hierarchy visibility (decision 2026-04-21): viewer sees only roles
  // strictly below their own; peers at same rank are hidden from each other.
  const VISIBLE_ROLES_BELOW: Record<string, string[]> = {
    super_admin: ['admin', 'manager', 'qa', 'leader', 'agent', 'agent_telesale', 'agent_collection'],
    admin: ['manager', 'qa', 'leader', 'agent', 'agent_telesale', 'agent_collection'],
    manager: ['qa', 'leader', 'agent', 'agent_telesale', 'agent_collection'],
    qa: ['agent', 'agent_telesale', 'agent_collection'],
    leader: ['agent', 'agent_telesale', 'agent_collection'],
    agent: [],
    agent_telesale: [],
    agent_collection: [],
  };
  const visibleRoles = userRole ? (VISIBLE_ROLES_BELOW[userRole] ?? []) : [];
  if (userRole && visibleRoles.length === 0) return [];

  // Get all users in this cluster that have extensions assigned
  const userWhere: Record<string, unknown> = {
    clusterId: activeCluster.id,
    status: 'active',
    OR: [
      { sipExtension: { not: null } },
      { extension: { not: null } },
    ],
  };
  if (userRole) userWhere.role = { in: visibleRoles };
  if (teamId) userWhere.teamId = teamId;

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, fullName: true,
      sipExtension: true, extension: true,
      sipRegistered: true,
      teamId: true,
      team: { select: { name: true, leader: { select: { fullName: true } } } },
    },
  });

  // Build ext→user map
  const extUserMap = new Map<string, typeof users[0]>();
  for (const u of users) {
    const ext = u.extension || u.sipExtension;
    if (ext) extUserMap.set(ext, u);
  }

  // Registration state is sourced from cluster_extensions.sip_registered (populated every 30s by
  // sip-presence-job), which covers all extensions. users.sip_registered is kept in sync for
  // per-agent queries elsewhere, but the dashboard uses the extension-level view.
  const result: AgentMonitor[] = clusterExts.map((ce) => {
    const user = extUserMap.get(ce.extension);
    const isRegistered = ce.sipRegistered || !!user?.sipRegistered;
    return {
      id: user?.id || ce.extension,
      fullName: user?.fullName || ce.callerName || `Ext ${ce.extension}`,
      extension: ce.extension,
      registered: isRegistered,
      status: isRegistered ? 'online' : 'offline',
      teamId: user?.teamId || null,
      teamName: user?.team?.name || null,
      teamLeader: user?.team?.leader?.fullName || null,
    };
  });

  // If teamId filter, only show entries with matching team
  if (teamId) {
    return result.filter((r) => r.teamId === teamId);
  }
  return result;
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
