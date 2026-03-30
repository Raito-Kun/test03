import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth-middleware';
import { requirePermission } from '../middleware/rbac-middleware';
import { getActiveCalls, getAgentStatuses, whisperToAgent } from '../services/monitoring-service';

const router = Router();

router.use(authMiddleware);

/** GET /monitoring/agents — all agent statuses (manager/leader) */
router.get('/agents', requirePermission('view_dashboard'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Leaders see only their team
    const teamId = req.user?.role === 'leader' ? req.user.teamId || undefined : undefined;
    const agents = await getAgentStatuses(teamId ?? undefined);
    res.json({ success: true, data: agents });
  } catch (err) {
    next(err);
  }
});

/** GET /monitoring/active-calls — currently active calls */
router.get('/active-calls', requirePermission('view_dashboard'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const calls = await getActiveCalls();
    res.json({ success: true, data: calls });
  } catch (err) {
    next(err);
  }
});

const whisperSchema = z.object({
  callUuid: z.string().min(1),
});

/** POST /monitoring/whisper — whisper to agent during call */
router.post('/whisper', requirePermission('view_recordings'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = whisperSchema.parse(req.body);
    const managerExt = await getManagerExtension(req.user!.userId);
    await whisperToAgent(input.callUuid, managerExt);
    res.json({ success: true, data: { message: 'Whisper initiated' } });
  } catch (err) {
    next(err);
  }
});

async function getManagerExtension(userId: string): Promise<string> {
  const { default: prisma } = await import('../lib/prisma');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { sipExtension: true } });
  if (!user?.sipExtension) {
    throw Object.assign(new Error('Manager has no SIP extension'), { code: 'NO_EXTENSION' });
  }
  return user.sipExtension;
}

export default router;
