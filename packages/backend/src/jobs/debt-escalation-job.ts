import prisma from '../lib/prisma';
import { createNotification } from '../services/notification-service';
import { logAudit } from '../lib/audit';
import logger from '../lib/logger';
import { DebtTier } from '@prisma/client';

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Determine tier based on days-past-due */
function calcTier(dpd: number): DebtTier {
  if (dpd <= 0) return 'current';
  if (dpd <= 30) return 'dpd_1_30';
  if (dpd <= 60) return 'dpd_31_60';
  if (dpd <= 90) return 'dpd_61_90';
  return 'dpd_90_plus';
}

async function runEscalation(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeCases = await prisma.debtCase.findMany({
    where: { status: { in: ['active', 'in_progress'] } },
    select: {
      id: true,
      dpd: true,
      tier: true,
      dueDate: true,
      assignedTo: true,
      contact: { select: { fullName: true } },
    },
  });

  let escalatedCount = 0;

  for (const dc of activeCases) {
    // Calculate DPD from dueDate if available, else use stored dpd
    let currentDpd = dc.dpd;
    if (dc.dueDate) {
      const msPerDay = 24 * 60 * 60 * 1000;
      currentDpd = Math.max(0, Math.floor((today.getTime() - dc.dueDate.getTime()) / msPerDay));
    }

    const newTier = calcTier(currentDpd);

    if (newTier === dc.tier && currentDpd === dc.dpd) continue;

    await prisma.debtCase.update({
      where: { id: dc.id },
      data: { dpd: currentDpd, tier: newTier },
    });

    logAudit(
      null,
      'update',
      'debt_cases',
      dc.id,
      { oldTier: dc.tier, newTier, oldDpd: dc.dpd, newDpd: currentDpd, reason: 'auto_escalation' },
    );

    // Notify assigned agent when tier changes
    if (newTier !== dc.tier && dc.assignedTo) {
      createNotification(
        dc.assignedTo,
        'debt_escalated',
        'Debt Case Escalated',
        `Debt case for ${dc.contact.fullName} escalated to tier ${newTier} (DPD: ${currentDpd})`,
        'debt_case',
        dc.id,
      ).catch(() => undefined);
    }

    escalatedCount++;
  }

  if (escalatedCount > 0) {
    logger.info('Debt escalation job completed', { escalated: escalatedCount });
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startDebtEscalationJob(): void {
  if (intervalHandle) return;
  logger.info('Debt escalation job started');
  // Run immediately, then every 24h
  runEscalation().catch((err: unknown) => {
    logger.error('Debt escalation job error', { error: (err as Error).message });
  });
  intervalHandle = setInterval(() => {
    runEscalation().catch((err: unknown) => {
      logger.error('Debt escalation job error', { error: (err as Error).message });
    });
  }, INTERVAL_MS);
}

export function stopDebtEscalationJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
