import redis from '../lib/redis';
import prisma from '../lib/prisma';
import { AgentStatus } from '@prisma/client';
import { emitToUser } from '../lib/socket-io';
import logger from '../lib/logger';

const STATUS_KEY = (userId: string) => `agent_status:${userId}`;
const STATUS_TTL = 86400; // 24h

export interface AgentStatusInfo {
  userId: string;
  status: AgentStatus;
  updatedAt: string;
}

/** Get agent status from Redis (fallback: offline) */
export async function getAgentStatus(userId: string): Promise<AgentStatusInfo> {
  const raw = await redis.get(STATUS_KEY(userId));
  if (raw) {
    return JSON.parse(raw) as AgentStatusInfo;
  }
  return { userId, status: 'offline', updatedAt: new Date().toISOString() };
}

/** Set agent status in Redis and persist log to DB */
export async function setAgentStatus(
  userId: string,
  status: AgentStatus,
  reason?: string,
): Promise<AgentStatusInfo> {
  const info: AgentStatusInfo = {
    userId,
    status,
    updatedAt: new Date().toISOString(),
  };

  await redis.set(STATUS_KEY(userId), JSON.stringify(info), 'EX', STATUS_TTL);

  // Persist to DB (fire and forget)
  prisma.agentStatusLog
    .create({
      data: { userId, status, reason: reason || null },
    })
    .catch((e) => logger.error('Failed to persist agent status log', { error: e.message }));

  // Push to Socket.IO
  emitToUser(userId, 'agent:status_change', info);

  return info;
}

/** Get all agents with their current status from Redis */
export async function getAllAgentStatuses(): Promise<AgentStatusInfo[]> {
  const users = await prisma.user.findMany({
    where: { status: 'active' },
    select: { id: true },
  });

  const results = await Promise.all(users.map((u) => getAgentStatus(u.id)));
  return results;
}
