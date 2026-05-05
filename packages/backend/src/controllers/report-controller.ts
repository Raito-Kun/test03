import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as reportService from '../services/report-service';
import * as summaryService from '../services/report-summary-service';
import * as detailService from '../services/report-detail-service';
import * as chartService from '../services/report-chart-service';
import * as ticketReportService from '../services/report-ticket-service';

/** Default: first day of current month */
function defaultStartDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Default: today */
function defaultEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const dateRangeSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  group_by: z.enum(['day', 'agent', 'direction']).optional(),
  user_id: z.string().uuid().optional(),
  campaign_id: z.string().uuid().optional(),
});

function parseFilters(query: Record<string, unknown>) {
  const parsed = dateRangeSchema.parse(query);
  return {
    startDate: parsed.start_date || defaultStartDate(),
    endDate: parsed.end_date || defaultEndDate(),
    groupBy: parsed.group_by as 'day' | 'agent' | 'direction' | undefined,
    userId: parsed.user_id,
    campaignId: parsed.campaign_id,
  };
}

/** GET /reports/calls */
export async function getCallReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const data = await reportService.getCallReport(filters, req.dataScope || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /reports/telesale */
export async function getTelesaleReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const data = await reportService.getTelesaleReport(filters, req.dataScope || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /reports/collection */
export async function getCollectionReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const data = await reportService.getCollectionReport(filters, req.dataScope || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /reports/sla */
export async function getSlaReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const data = await reportService.getSlaReport(filters, req.dataScope || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ─── New Report Endpoints ────────────────────────────────────────────────────

const summaryQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  user_id: z.string().uuid().optional(),
  team_id: z.string().uuid().optional(),
});

const detailQuerySchema = summaryQuerySchema.extend({
  hangup_cause: z.string().optional(),
  sip_code: z.string().regex(/^\d+$/).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

function parseSummaryFilters(query: Record<string, unknown>) {
  const parsed = summaryQuerySchema.parse(query);
  return {
    startDate: parsed.start_date || defaultStartDate(),
    endDate: parsed.end_date || defaultEndDate(),
    userId: parsed.user_id,
    teamId: parsed.team_id,
  };
}

/** GET /reports/calls/summary */
export async function getCallSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = parseSummaryFilters(req.query as Record<string, unknown>);
    const data = await summaryService.getCallSummaryByAgent(filters, req.dataScope || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /reports/calls/summary-by-team */
export async function getCallSummaryByTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = parseSummaryFilters(req.query as Record<string, unknown>);
    const data = await summaryService.getCallSummaryByTeam(filters, req.dataScope || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /reports/tickets/summary — tickets grouped by creator */
export async function getTicketSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = parseSummaryFilters(req.query as Record<string, unknown>);
    const data = await ticketReportService.getTicketSummaryByAgent(filters, req.dataScope || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /reports/calls/detail */
export async function getCallDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = detailQuerySchema.parse(req.query);
    const filters: detailService.DetailFilter = {
      startDate: parsed.start_date || defaultStartDate(),
      endDate: parsed.end_date || defaultEndDate(),
      userId: parsed.user_id,
      teamId: parsed.team_id,
      hangupCause: parsed.hangup_cause,
      sipCode: parsed.sip_code ? parseInt(parsed.sip_code, 10) : undefined,
      page: parsed.page ? Math.max(1, parseInt(parsed.page, 10)) : 1,
      limit: parsed.limit ? Math.min(200, Math.max(1, parseInt(parsed.limit, 10))) : 50,
    };
    const result = await detailService.getCallDetail(filters, req.dataScope || {});
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/** GET /reports/calls/charts */
export async function getCallCharts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filters = parseSummaryFilters(req.query as Record<string, unknown>);
    const data = await chartService.getCallCharts(filters, req.dataScope || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
