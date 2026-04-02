import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth-middleware';
import { requirePermission } from '../middleware/rbac-middleware';
import * as scriptService from '../services/call-script-service';
import prisma from '../lib/prisma';

const router = Router();
router.use(authMiddleware);

/** GET /scripts/active?campaignId=X — resolve script by campaign */
router.get('/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const campaignId = req.query.campaignId as string | undefined;
    const product = req.query.product as string | undefined;
    const script = await scriptService.resolveScript(userId, campaignId, product);
    res.json({ success: true, data: script });
  } catch (err) {
    next(err);
  }
});

/** GET /scripts/default — return the default script */
router.get('/default', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const defaultScript = await prisma.callScript.findFirst({
      where: { type: 'default', isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: defaultScript });
  } catch (err) {
    next(err);
  }
});

/** GET /scripts/active-call — resolve script for agent's current/recent call */
router.get('/active-call', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    // Find agent's most recent call (within last 5 minutes)
    const recentCall = await prisma.callLog.findFirst({
      where: { userId, startTime: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
      select: { campaignId: true, contact: { select: { fullName: true, phone: true } } },
      orderBy: { startTime: 'desc' },
    });

    // Find lead product if campaign-linked
    let product: string | null = null;
    if (recentCall?.campaignId) {
      const lead = await prisma.lead.findFirst({
        where: { campaignId: recentCall.campaignId, assignedTo: userId },
        select: { product: true },
        orderBy: { updatedAt: 'desc' },
      });
      product = lead?.product || null;
    }

    const script = await scriptService.resolveScript(userId, recentCall?.campaignId, product);
    if (!script) {
      res.json({ success: true, data: null });
      return;
    }

    // Substitute variables
    const agentUser = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    const content = scriptService.substituteVariables(script.content, {
      customer_name: recentCall?.contact?.fullName || 'Quý khách',
      agent_name: agentUser?.fullName || '',
      product: product || '',
      phone: recentCall?.contact?.phone || '',
    });

    res.json({ success: true, data: { ...script, content } });
  } catch (err) {
    next(err);
  }
});

/** GET /scripts — list all scripts (admin/manager) */
router.get('/', requirePermission('manage_campaigns'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const scripts = await scriptService.listScripts();
    res.json({ success: true, data: scripts });
  } catch (err) {
    next(err);
  }
});

const scriptSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['default', 'product']),
  product: z.string().max(100).optional(),
  content: z.string().min(1),
});

/** POST /scripts — create script */
router.post('/', requirePermission('manage_campaigns'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = scriptSchema.parse(req.body);
    const script = await scriptService.createScript({ ...input, createdBy: req.user!.userId });
    res.status(201).json({ success: true, data: script });
  } catch (err) {
    next(err);
  }
});

/** PATCH /scripts/:id — update script */
router.patch('/:id', requirePermission('manage_campaigns'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const script = await scriptService.updateScript(req.params.id as string, req.body);
    res.json({ success: true, data: script });
  } catch (err) {
    next(err);
  }
});

/** DELETE /scripts/:id — delete script */
router.delete('/:id', requirePermission('manage_campaigns'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await scriptService.deleteScript(req.params.id as string);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

export default router;
