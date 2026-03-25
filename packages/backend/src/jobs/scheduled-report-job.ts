import prisma from '../lib/prisma';
import logger from '../lib/logger';
import { sendReportEmail } from '../services/email-service';

/** Run daily at 8:00 AM — sends summary reports to managers */
export function startScheduledReportJob(): void {
  const INTERVAL = 24 * 60 * 60 * 1000; // 24h

  async function runReport() {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Collect daily stats
      const [totalCalls, totalTickets, totalLeads] = await Promise.all([
        prisma.callLog.count({ where: { startTime: { gte: yesterday } } }),
        prisma.ticket.count({ where: { createdAt: { gte: yesterday } } }),
        prisma.lead.count({ where: { createdAt: { gte: yesterday } } }),
      ]);

      // Get managers to send report to
      const managers = await prisma.user.findMany({
        where: { role: { in: ['admin', 'manager'] } },
        select: { email: true, fullName: true },
      });

      const reportDate = yesterday.toISOString().split('T')[0];
      const subject = `Báo cáo CRM hàng ngày — ${reportDate}`;
      const body = `
Báo cáo CRM — ${reportDate}

Tổng cuộc gọi: ${totalCalls}
Phiếu ghi mới: ${totalTickets}
Lead mới: ${totalLeads}

---
Hệ thống CRM Omnichannel
      `.trim();

      for (const mgr of managers) {
        await sendReportEmail(mgr.email, subject, body);
      }

      logger.info('Scheduled report sent', { recipients: managers.length, date: reportDate });
    } catch (err) {
      logger.error('Scheduled report error', { error: (err as Error).message });
    }
  }

  // Run first report check after 1 minute, then every 24h
  setTimeout(() => {
    runReport();
    setInterval(runReport, INTERVAL);
  }, 60 * 1000);

  logger.info('Scheduled report job started (daily at 24h interval)');
}
