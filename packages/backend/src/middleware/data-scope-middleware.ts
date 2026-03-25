import { Request, Response, NextFunction } from 'express';

/**
 * Data scope middleware factory.
 * Attaches req.dataScope with Prisma `where` conditions based on user role.
 *
 * - admin/manager/qa → no filter (all data)
 * - leader → filter by team_id
 * - agent_telesale/agent_collection → filter by assigned field = userId
 *
 * @param userField - The DB column that stores the assigned user (e.g., 'assigned_to', 'user_id')
 * @param teamField - The DB column that stores team membership (default: via user's teamId)
 */
export function applyDataScope(userField: string = 'assigned_to') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const { role, userId, teamId } = req.user;

    switch (role) {
      case 'admin':
      case 'manager':
      case 'qa':
        // Full access — no filter
        req.dataScope = {};
        break;

      case 'leader':
        // Team-level access: filter entities assigned to users in the same team
        if (teamId) {
          req.dataScope = { _teamScope: teamId, _userField: userField };
        } else {
          req.dataScope = {};
        }
        break;

      case 'agent_telesale':
      case 'agent_collection':
        // Own data only
        req.dataScope = { _agentScope: userId, _userField: userField };
        break;

      default:
        req.dataScope = { [userField]: userId };
    }

    next();
  };
}

/**
 * Build Prisma where clause from dataScope for services.
 * Handles both direct field filtering and team-based filtering.
 *
 * @param dataScope - The scope object from middleware
 * @param userField - The Prisma camelCase field (e.g., 'assignedTo', 'userId')
 * @param relationField - The Prisma relation name for the user (e.g., 'assignedUser', 'user')
 */
export function buildScopeWhere(
  dataScope: Record<string, unknown>,
  userField: string = 'assignedTo',
  relationField: string = 'assignedUser',
): Record<string, unknown> {
  if (!dataScope || Object.keys(dataScope).length === 0) {
    return {};
  }

  const teamScope = dataScope['_teamScope'] as string | undefined;
  if (teamScope) {
    return {
      [relationField]: { teamId: teamScope },
    };
  }

  const agentScope = dataScope['_agentScope'] as string | undefined;
  if (agentScope) {
    // Only Contact and Ticket models have createdBy field
    const hasCreatedBy = dataScope['_hasCreatedBy'] as boolean | undefined;
    if (hasCreatedBy) {
      return {
        OR: [
          { [userField]: agentScope },
          { createdBy: agentScope },
        ],
      };
    }
    return { [userField]: agentScope };
  }

  // Direct field match (remove internal keys)
  const where: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dataScope)) {
    if (!key.startsWith('_')) {
      where[key] = value;
    }
  }
  return where;
}
