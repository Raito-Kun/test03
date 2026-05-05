import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import logger from './lib/logger';
import { globalLimiter } from './middleware/rate-limiter';
import { errorHandler } from './middleware/error-handler';
import { initSocketIO } from './lib/socket-io';
import eslDaemon from './lib/esl-daemon';
import { startReminderJob } from './jobs/reminder-job';
import { startScheduledReportJob } from './jobs/scheduled-report-job';
import { startDebtEscalationJob } from './jobs/debt-escalation-job';
import { startSipPresenceJob } from './jobs/sip-presence-job';

// Phase 02-03 routes
import authRoutes from './routes/auth-routes';
import userRoutes from './routes/user-routes';
import teamRoutes from './routes/team-routes';
import contactRoutes from './routes/contact-routes';
import leadRoutes from './routes/lead-routes';
import debtCaseRoutes from './routes/debt-case-routes';
import campaignRoutes from './routes/campaign-routes';

// Phase 04 routes
import callRoutes from './routes/call-routes';
import webhookRoutes from './routes/webhook-routes';
import agentStatusRoutes from './routes/agent-status-routes';

// Phase 05 routes
import callLogRoutes from './routes/call-log-routes';
import dispositionCodeRoutes from './routes/disposition-code-routes';
import qaAnnotationRoutes from './routes/qa-annotation-routes';

// Phase 06 routes
import ticketRoutes from './routes/ticket-routes';
import ticketCategoryRoutes from './routes/ticket-category-routes';
import macroRoutes from './routes/macro-routes';
import notificationRoutes from './routes/notification-routes';

// Phase 07 routes
import dashboardRoutes from './routes/dashboard-routes';
import reportRoutes from './routes/report-routes';

// Phase 10 routes
import aiRoutes from './routes/ai-routes';

// Phase 12 routes
import permissionRoutes from './routes/permission-routes';

// Phase 13 routes
import extensionRoutes from './routes/extension-routes';

// Phase 15 routes
import templateRoutes from './routes/template-routes';

// Phase 2 (v1.2) routes
import exportRoutes from './routes/export-routes';
import assignmentRoutes from './routes/assignment-routes';
import scriptRoutes from './routes/script-routes';
import contactMergeRoutes from './routes/contact-merge-routes';
import monitoringRoutes from './routes/monitoring-routes';
import qaTimestampRoutes from './routes/qa-timestamp-routes';

// Phase 13 gap closure routes
import guarantorRoutes from './routes/guarantor-routes';
import campaignProgressRoutes from './routes/campaign-progress-routes';
import rpcRoutes from './routes/rpc-routes';
import slaAlertRoutes from './routes/sla-alert-routes';

// RBAC & data allocation routes
import dataAllocationRoutes from './routes/data-allocation-routes';

// PBX Cluster routes
import clusterRoutes from './routes/cluster-routes';

// Feature flag routes
import featureFlagRoutes from './routes/feature-flag-routes';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// Trust first proxy hop (Nginx) for correct req.ip
app.set('trust proxy', 1);

// Security & parsing middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: ['text/xml', 'application/xml'], limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('short', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(globalLimiter);

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Phase 02-03 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/teams', teamRoutes);
app.use('/api/v1/contacts', contactRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/debt-cases', debtCaseRoutes);
app.use('/api/v1/campaigns', campaignRoutes);

// Phase 04 routes
app.use('/api/v1/calls', callRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/agents', agentStatusRoutes);

// Phase 05 routes
app.use('/api/v1/call-logs', callLogRoutes);
app.use('/api/v1/disposition-codes', dispositionCodeRoutes);
app.use('/api/v1/qa-annotations', qaAnnotationRoutes);

// Phase 06 routes
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/ticket-categories', ticketCategoryRoutes);
app.use('/api/v1/macros', macroRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Phase 07 routes
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/reports', reportRoutes);

// Phase 10 routes
app.use('/api/v1/ai', aiRoutes);

// Phase 12 routes
app.use('/api/v1/permissions', permissionRoutes);

// Phase 13 routes
app.use('/api/v1/extensions', extensionRoutes);

// Phase 15 routes
app.use('/api/v1/templates', templateRoutes);

// Phase 2 (v1.2) routes
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/assignments', assignmentRoutes);
app.use('/api/v1/scripts', scriptRoutes);
app.use('/api/v1/contact-merge', contactMergeRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/qa-timestamps', qaTimestampRoutes);

// Phase 13 gap closure routes
app.use('/api/v1/guarantors', guarantorRoutes);
app.use('/api/v1/campaign-progress', campaignProgressRoutes);
app.use('/api/v1/rpc', rpcRoutes);
app.use('/api/v1/sla-alerts', slaAlertRoutes);

// RBAC & data allocation routes
app.use('/api/v1/data-allocation', dataAllocationRoutes);

// PBX Cluster routes
app.use('/api/v1/clusters', clusterRoutes);

// Feature flag routes
app.use('/api/v1/feature-flags', featureFlagRoutes);

// Error handler (must be after routes)
app.use(errorHandler);

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO
initSocketIO(server);

// Start server (skip in test mode — supertest handles it)
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`CRM Backend running on port ${PORT}`);

    // Connect ESL daemon (non-blocking — auto-reconnects)
    if (process.env.ESL_ENABLED !== 'false') {
      eslDaemon.connect();
    }

    // Start jobs
    startReminderJob();
    startScheduledReportJob();
    startDebtEscalationJob();
    if (process.env.SIP_PRESENCE_ENABLED !== 'false') {
      startSipPresenceJob();
    }
  });
}

export default app;
