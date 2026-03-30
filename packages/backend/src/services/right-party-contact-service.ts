import prisma from '../lib/prisma';
import logger from '../lib/logger';

export interface MarkRpcParams {
  callLogId: string;
  isRightParty: boolean;
  userId?: string;
}

export interface RpcFilters {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  teamId?: string;
}

export interface RpcAgentStat {
  userId: string;
  fullName: string;
  totalCalls: number;
  rpcCalls: number;
  rpcRate: number;
}

export interface RpcStats {
  totalCalls: number;
  rpcCalls: number;
  rpcRate: number;
  byAgent?: RpcAgentStat[];
}

const RPC_TRUE_FLAG = '"isRightParty":true';

export async function markRightPartyContact(params: MarkRpcParams): Promise<{ success: boolean }> {
  try {
    const callLog = await prisma.callLog.findUniqueOrThrow({
      where: { id: params.callLogId },
    });

    let meta: Record<string, unknown> = {};
    if (callLog.notes) {
      try { meta = JSON.parse(callLog.notes); } catch { meta = { notes: callLog.notes }; }
    }
    meta.isRightParty = params.isRightParty;
    if (params.userId) meta.rpcMarkedBy = params.userId;

    await prisma.callLog.update({
      where: { id: params.callLogId },
      data: { notes: JSON.stringify(meta) },
    });

    logger.info('markRightPartyContact updated', params);
    return { success: true };
  } catch (error) {
    logger.error('markRightPartyContact failed', error);
    throw error;
  }
}

export async function getRpcStats(filters: RpcFilters): Promise<RpcStats> {
  try {
    const where: Record<string, unknown> = {};

    if (filters.dateFrom || filters.dateTo) {
      where.startTime = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      };
    }

    if (filters.userId) {
      where.userId = filters.userId;
    } else if (filters.teamId) {
      where.user = { teamId: filters.teamId };
    }

    const callLogs = await prisma.callLog.findMany({
      where,
      select: {
        id: true,
        notes: true,
        userId: true,
        user: { select: { fullName: true } },
      },
    });

    const totalCalls = callLogs.length;
    const rpcCalls = callLogs.filter((c) => c.notes?.includes(RPC_TRUE_FLAG)).length;
    const rpcRate = totalCalls > 0 ? Math.round((rpcCalls / totalCalls) * 10000) / 100 : 0;

    if (filters.userId) {
      return { totalCalls, rpcCalls, rpcRate };
    }

    // Group by agent when no userId filter
    const agentMap = new Map<string, { fullName: string; total: number; rpc: number }>();
    for (const c of callLogs) {
      if (!c.userId) continue;
      const existing = agentMap.get(c.userId) ?? {
        fullName: c.user?.fullName ?? c.userId,
        total: 0,
        rpc: 0,
      };
      existing.total += 1;
      if (c.notes?.includes(RPC_TRUE_FLAG)) existing.rpc += 1;
      agentMap.set(c.userId, existing);
    }

    const byAgent: RpcAgentStat[] = Array.from(agentMap.entries()).map(([userId, s]) => ({
      userId,
      fullName: s.fullName,
      totalCalls: s.total,
      rpcCalls: s.rpc,
      rpcRate: s.total > 0 ? Math.round((s.rpc / s.total) * 10000) / 100 : 0,
    }));

    return { totalCalls, rpcCalls, rpcRate, byAgent };
  } catch (error) {
    logger.error('getRpcStats failed', error);
    throw error;
  }
}
