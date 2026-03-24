import prisma from '../lib/prisma';
import { createNotification } from '../services/notification-service';
import redis from '../lib/redis';
import logger from '../lib/logger';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEDUP_TTL = 3600; // 1 hour — avoid re-notifying within an hour

async function checkLeadFollowUps(): Promise<void> {
  const now = new Date();
  const soon = new Date(now.getTime() + 15 * 60 * 1000); // +15min

  const leads = await prisma.lead.findMany({
    where: {
      nextFollowUp: { gte: now, lte: soon },
      status: { notIn: ['won', 'lost'] },
      assignedTo: { not: null },
    },
    select: { id: true, assignedTo: true, contact: { select: { fullName: true } } },
  });

  for (const lead of leads) {
    if (!lead.assignedTo) continue;

    const dedupKey = `notif_dedup:lead_followup:${lead.id}`;
    const exists = await redis.get(dedupKey);
    if (exists) continue;

    await createNotification(
      lead.assignedTo,
      'follow_up_reminder',
      'Follow-up Reminder',
      `Lead for ${lead.contact.fullName} requires follow-up within 15 minutes`,
      'lead',
      lead.id,
    );

    await redis.set(dedupKey, '1', 'EX', DEDUP_TTL);
  }
}

async function checkDebtCasePtp(): Promise<void> {
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrowDate = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);

  const cases = await prisma.debtCase.findMany({
    where: {
      promiseDate: { gte: todayDate, lt: tomorrowDate },
      status: { in: ['promise_to_pay', 'in_progress'] },
      assignedTo: { not: null },
    },
    select: { id: true, assignedTo: true, contact: { select: { fullName: true } } },
  });

  for (const dc of cases) {
    if (!dc.assignedTo) continue;

    const dedupKey = `notif_dedup:ptp_due:${dc.id}`;
    const exists = await redis.get(dedupKey);
    if (exists) continue;

    await createNotification(
      dc.assignedTo,
      'ptp_due',
      'Promise to Pay Due Today',
      `Debt case for ${dc.contact.fullName} has a promise to pay due today`,
      'debt_case',
      dc.id,
    );

    await redis.set(dedupKey, '1', 'EX', DEDUP_TTL);
  }
}

async function runChecks(): Promise<void> {
  try {
    await Promise.all([checkLeadFollowUps(), checkDebtCasePtp()]);
  } catch (err: unknown) {
    const e = err as Error;
    logger.error('Reminder job error', { error: e.message });
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startReminderJob(): void {
  if (intervalHandle) return;
  logger.info('Reminder job started');
  // Run immediately on start, then every 5min
  runChecks().catch(() => undefined);
  intervalHandle = setInterval(() => {
    runChecks().catch(() => undefined);
  }, INTERVAL_MS);
}

export function stopReminderJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
