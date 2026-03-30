import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { TicketPriority, TicketStatus } from '@prisma/client';

// SLA thresholds in milliseconds: [firstResponseMs, resolutionMs]
const SLA_THRESHOLDS: Record<TicketPriority, [number, number]> = {
  urgent: [1 * 60 * 60 * 1000, 4 * 60 * 60 * 1000],
  high: [4 * 60 * 60 * 1000, 24 * 60 * 60 * 1000],
  medium: [8 * 60 * 60 * 1000, 72 * 60 * 60 * 1000],
  low: [24 * 60 * 60 * 1000, 168 * 60 * 60 * 1000],
};

const APPROACHING_THRESHOLD = 0.8;

export interface SlaTicketInfo {
  id: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: Date;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  slaBreached: boolean;
  firstResponseDeadline: Date;
  resolutionDeadline: Date;
}

export interface SlaBreachResult {
  approaching: SlaTicketInfo[];
  breached: SlaTicketInfo[];
}

export interface SlaSummary {
  totalOpen: number;
  approaching: number;
  breached: number;
  compliancePercent: number;
}

type SlaQuery = Record<string, unknown>;

function buildSlaInfo(ticket: {
  id: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: Date;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  slaBreached: boolean;
}): SlaTicketInfo {
  const [firstMs, resolveMs] = SLA_THRESHOLDS[ticket.priority];
  return {
    ...ticket,
    firstResponseDeadline: new Date(ticket.createdAt.getTime() + firstMs),
    resolutionDeadline: new Date(ticket.createdAt.getTime() + resolveMs),
  };
}

function isBreached(info: SlaTicketInfo, now: Date): boolean {
  if (!info.resolvedAt && now > info.resolutionDeadline) return true;
  if (!info.firstResponseAt && now > info.firstResponseDeadline) return true;
  return false;
}

function isApproaching(info: SlaTicketInfo, now: Date): boolean {
  if (isBreached(info, now)) return false;
  const [firstMs, resolveMs] = SLA_THRESHOLDS[info.priority];

  if (!info.firstResponseAt) {
    const elapsed = now.getTime() - info.createdAt.getTime();
    if (elapsed >= firstMs * APPROACHING_THRESHOLD) return true;
  }
  if (!info.resolvedAt) {
    const elapsed = now.getTime() - info.createdAt.getTime();
    if (elapsed >= resolveMs * APPROACHING_THRESHOLD) return true;
  }
  return false;
}

async function fetchOpenTickets(query: SlaQuery) {
  const where: Record<string, unknown> = {
    status: { notIn: [TicketStatus.closed, TicketStatus.resolved] },
  };

  if (query.priority) where.priority = query.priority;
  if (query.userId) where.userId = query.userId;

  return prisma.ticket.findMany({
    where,
    select: {
      id: true,
      priority: true,
      status: true,
      createdAt: true,
      firstResponseAt: true,
      resolvedAt: true,
      slaBreached: true,
    },
  });
}

export async function getSlaBreaches(query: SlaQuery = {}): Promise<SlaBreachResult> {
  try {
    const tickets = await fetchOpenTickets(query);
    const now = new Date();
    const approaching: SlaTicketInfo[] = [];
    const breached: SlaTicketInfo[] = [];

    for (const t of tickets) {
      const info = buildSlaInfo(t);
      if (isBreached(info, now)) {
        breached.push(info);
      } else if (isApproaching(info, now)) {
        approaching.push(info);
      }
    }

    logger.info('getSlaBreaches completed', { approaching: approaching.length, breached: breached.length });
    return { approaching, breached };
  } catch (error) {
    logger.error('getSlaBreaches failed', error);
    throw error;
  }
}

export async function getSlaSummaryStats(query: SlaQuery = {}): Promise<SlaSummary> {
  try {
    const tickets = await fetchOpenTickets(query);
    const now = new Date();
    let approachingCount = 0;
    let breachedCount = 0;

    for (const t of tickets) {
      const info = buildSlaInfo(t);
      if (isBreached(info, now)) {
        breachedCount += 1;
      } else if (isApproaching(info, now)) {
        approachingCount += 1;
      }
    }

    const totalOpen = tickets.length;
    const compliant = totalOpen - breachedCount;
    const compliancePercent = totalOpen > 0
      ? Math.round((compliant / totalOpen) * 10000) / 100
      : 100;

    return { totalOpen, approaching: approachingCount, breached: breachedCount, compliancePercent };
  } catch (error) {
    logger.error('getSlaSummaryStats failed', error);
    throw error;
  }
}
