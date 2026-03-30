import prisma from '../lib/prisma';
import logger from '../lib/logger';

type AssignmentMode = 'round_robin' | 'workload' | 'skill';

interface AssignmentResult {
  total: number;
  perAgent: Record<string, number>;
  mode: AssignmentMode;
}

/**
 * Auto-assign unassigned leads in a campaign to agents.
 * 3 modes: round-robin, workload-based, skill-based.
 */
export async function autoAssignLeads(
  campaignId: string,
  teamId: string,
  mode: AssignmentMode = 'round_robin',
): Promise<AssignmentResult> {
  // Fetch active agents in the team
  const agents = await prisma.user.findMany({
    where: { teamId, status: 'active' },
    select: { id: true, fullName: true, sipExtension: true },
  });

  if (agents.length === 0) {
    throw Object.assign(new Error('Không có nhân viên nào trong nhóm'), { code: 'NO_AGENTS' });
  }

  // Fetch unassigned leads for this campaign
  const unassignedLeads = await prisma.lead.findMany({
    where: { campaignId, assignedTo: null },
    select: { id: true, product: true },
    orderBy: { createdAt: 'asc' },
  });

  if (unassignedLeads.length === 0) {
    return { total: 0, perAgent: {}, mode };
  }

  let assignments: { leadId: string; agentId: string }[];

  switch (mode) {
    case 'workload':
      assignments = await assignByWorkload(unassignedLeads, agents, campaignId);
      break;
    case 'skill':
      assignments = await assignBySkill(unassignedLeads, agents);
      break;
    default:
      assignments = assignRoundRobin(unassignedLeads, agents);
  }

  // Bulk update in a transaction
  await prisma.$transaction(
    assignments.map((a) =>
      prisma.lead.update({ where: { id: a.leadId }, data: { assignedTo: a.agentId } }),
    ),
  );

  // Build summary
  const perAgent: Record<string, number> = {};
  for (const a of assignments) {
    const agent = agents.find((ag) => ag.id === a.agentId);
    const name = agent?.fullName || a.agentId;
    perAgent[name] = (perAgent[name] || 0) + 1;
  }

  logger.info('Leads auto-assigned', { campaignId, mode, total: assignments.length, perAgent });
  return { total: assignments.length, perAgent, mode };
}

/** Round-robin: distribute evenly, lead[0]→agent[0], lead[1]→agent[1], ... */
function assignRoundRobin(
  leads: { id: string }[],
  agents: { id: string }[],
): { leadId: string; agentId: string }[] {
  return leads.map((lead, i) => ({
    leadId: lead.id,
    agentId: agents[i % agents.length].id,
  }));
}

/** Workload-based: assign to agent with fewest active (non-won/lost) leads */
async function assignByWorkload(
  leads: { id: string }[],
  agents: { id: string }[],
  campaignId: string,
): Promise<{ leadId: string; agentId: string }[]> {
  // Count current active leads per agent
  const counts = await prisma.lead.groupBy({
    by: ['assignedTo'],
    where: {
      campaignId,
      assignedTo: { in: agents.map((a) => a.id) },
      status: { notIn: ['won', 'lost'] },
    },
    _count: true,
  });

  const workload = new Map<string, number>();
  for (const agent of agents) {
    const found = counts.find((c) => c.assignedTo === agent.id);
    workload.set(agent.id, found?._count || 0);
  }

  const assignments: { leadId: string; agentId: string }[] = [];
  for (const lead of leads) {
    // Find agent with lowest workload
    let minAgent = agents[0].id;
    let minCount = Infinity;
    for (const [agentId, count] of workload) {
      if (count < minCount) {
        minCount = count;
        minAgent = agentId;
      }
    }
    assignments.push({ leadId: lead.id, agentId: minAgent });
    workload.set(minAgent, (workload.get(minAgent) || 0) + 1);
  }

  return assignments;
}

/** Skill-based: match lead.product to agent who handles that product most */
async function assignBySkill(
  leads: { id: string; product: string | null }[],
  agents: { id: string }[],
): Promise<{ leadId: string; agentId: string }[]> {
  // Build agent skill map: which agent has handled which products
  const pastLeads = await prisma.lead.groupBy({
    by: ['assignedTo', 'product'],
    where: {
      assignedTo: { in: agents.map((a) => a.id) },
      product: { not: null },
      status: { in: ['won', 'qualified'] },
    },
    _count: true,
  });

  // Map: product → agentId with highest count
  const productSkill = new Map<string, string>();
  const productBest = new Map<string, number>();
  for (const row of pastLeads) {
    if (!row.product) continue;
    const current = productBest.get(row.product) || 0;
    if (row._count > current && row.assignedTo) {
      productSkill.set(row.product, row.assignedTo);
      productBest.set(row.product, row._count);
    }
  }

  // Fallback: round-robin for leads without product match
  let rrIndex = 0;
  return leads.map((lead) => {
    const skillAgent = lead.product ? productSkill.get(lead.product) : undefined;
    if (skillAgent) {
      return { leadId: lead.id, agentId: skillAgent };
    }
    // Fallback round-robin
    const agentId = agents[rrIndex % agents.length].id;
    rrIndex++;
    return { leadId: lead.id, agentId };
  });
}
