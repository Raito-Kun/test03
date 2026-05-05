import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getAllAgentStatuses } from '../services/agent-status-service';

const prisma = new PrismaClient();

/** Statuses that indicate an agent is online and available for new work. */
const AVAILABLE_STATUSES = new Set(['ready']);

type EntityType = 'contact' | 'lead' | 'debt_case' | 'campaign';

interface AllocateBody {
  entityType: EntityType;
  entityIds: string[];
  assignToUserId: string;
}

/**
 * POST /api/v1/data-allocation/allocate
 * Assigns selected entities to a user.
 * Requires crm.data_allocation permission.
 */
export async function allocateEntities(req: Request, res: Response): Promise<void> {
  try {
    const { entityType, entityIds, assignToUserId } = req.body as AllocateBody;

    if (!entityType || !entityIds || !assignToUserId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'entityType, entityIds, and assignToUserId are required' },
      });
      return;
    }

    if (!Array.isArray(entityIds) || entityIds.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'entityIds must be a non-empty array' },
      });
      return;
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: assignToUserId },
      select: { id: true, fullName: true, role: true, status: true },
    });

    if (!targetUser) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Target user not found' },
      });
      return;
    }

    if (targetUser.status !== 'active') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_USER', message: 'Cannot assign to inactive user' },
      });
      return;
    }

    let updatedCount = 0;

    switch (entityType) {
      case 'contact':
        const contactResult = await prisma.contact.updateMany({
          where: { id: { in: entityIds } },
          data: { assignedTo: assignToUserId },
        });
        updatedCount = contactResult.count;
        break;

      case 'lead':
        const leadResult = await prisma.lead.updateMany({
          where: { id: { in: entityIds } },
          data: { assignedTo: assignToUserId },
        });
        updatedCount = leadResult.count;
        break;

      case 'debt_case':
        const debtResult = await prisma.debtCase.updateMany({
          where: { id: { in: entityIds } },
          data: { assignedTo: assignToUserId },
        });
        updatedCount = debtResult.count;
        break;

      case 'campaign':
        // Campaigns don't have assignedTo — allocate by assigning leads/debt-cases under campaign to user
        res.status(400).json({
          success: false,
          error: { code: 'UNSUPPORTED', message: 'Campaign allocation assigns via leads. Use entityType: lead with campaignId filter.' },
        });
        return;

      default:
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `Invalid entityType: ${entityType}` },
        });
        return;
    }

    res.json({
      success: true,
      data: {
        updatedCount,
        entityType,
        assignedTo: { id: targetUser.id, fullName: targetUser.fullName },
      },
    });
  } catch (err) {
    console.error('allocateEntities error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to allocate entities' },
    });
  }
}

/**
 * GET /api/v1/data-allocation/agents
 * Returns list of agents that can be assigned data.
 * Query params:
 *   - onlineOnly=true → only return agents whose Redis-tracked status is "ready"
 *     (used by the import wizard so leaders only assign to available agents)
 */
export async function getAssignableAgents(req: Request, res: Response): Promise<void> {
  try {
    const onlineOnly = req.query.onlineOnly === 'true' || req.query.status === 'ready';

    const users = await prisma.user.findMany({
      where: {
        status: 'active',
        role: { in: ['agent', 'agent_telesale', 'agent_collection', 'leader'] },
      },
      select: { id: true, fullName: true, role: true, teamId: true },
      orderBy: { fullName: 'asc' },
    });

    if (!onlineOnly) {
      res.json({ success: true, data: users });
      return;
    }

    const statuses = await getAllAgentStatuses();
    const statusByUser = new Map(statuses.map((s) => [s.userId, s.status]));
    const filtered = users
      .filter((u) => AVAILABLE_STATUSES.has(statusByUser.get(u.id) ?? 'offline'))
      .map((u) => ({ ...u, agentStatus: statusByUser.get(u.id) ?? 'offline' }));

    res.json({ success: true, data: filtered });
  } catch (err) {
    console.error('getAssignableAgents error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch agents' },
    });
  }
}
