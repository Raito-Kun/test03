import redis from '../lib/redis';
import prisma from '../lib/prisma';
import { AgentStatus } from '@prisma/client';
import { emitToUser } from '../lib/socket-io';
import logger from '../lib/logger';

const STATUS_KEY = (userId: string) => `agent_status:${userId}`;
const STATUS_TTL = 86400; // 24h
const WRAPUP_TIMEOUT_MS = parseInt(process.env.WRAPUP_TIMEOUT_SECONDS || '30', 10) * 1000;
const WRAPUP_START_KEY = (userId: string) => `wrapup_start:${userId}`;

// Track active wrap-up timers (node process memory — clears on restart)
const wrapUpTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

/** Start wrap-up timer: after timeout, auto-transition agent to ready */
export async function startWrapUpTimer(userId: string): Promise<void> {
  // Cancel any existing timer
  cancelWrapUpTimer(userId);

  // Record wrap-up start time in Redis
  await redis.set(WRAPUP_START_KEY(userId), new Date().toISOString(), 'EX', 300);

  const timer = setTimeout(async () => {
    wrapUpTimers.delete(userId);
    try {
      const current = await getAgentStatus(userId);
      if (current.status === 'wrap_up') {
        await setAgentStatus(userId, 'ready', 'auto_wrapup_complete');
        logger.info('Wrap-up auto-completed', { userId });
      }
    } catch (e) {
      logger.error('Wrap-up auto-timer error', { userId, error: (e as Error).message });
    }
  }, WRAPUP_TIMEOUT_MS);

  wrapUpTimers.set(userId, timer);
}

/** Cancel wrap-up timer when agent gets a new call */
export function cancelWrapUpTimer(userId: string): void {
  const existing = wrapUpTimers.get(userId);
  if (existing) {
    clearTimeout(existing);
    wrapUpTimers.delete(userId);
  }
}

/** Get wrap-up start time for duration reporting */
export async function getWrapUpStartTime(userId: string): Promise<string | null> {
  return redis.get(WRAPUP_START_KEY(userId));
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
