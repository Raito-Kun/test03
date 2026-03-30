import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth-middleware';
import { requirePermission } from '../middleware/rbac-middleware';
import prisma from '../lib/prisma';

const router = Router();
router.use(authMiddleware);

const timestampSchema = z.object({
  time: z.number().min(0),
  note: z.string().min(1).max(500),
  severity: z.enum(['info', 'warning', 'error']).default('info'),
});

/** POST /qa-timestamps/:annotationId — add timestamp annotation to existing QA annotation */
router.post('/:annotationId', requirePermission('view_recordings'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { annotationId } = req.params;
    const input = timestampSchema.parse(req.body);

    const annotation = await prisma.qaAnnotation.findUnique({
      where: { id: annotationId as string },
      select: { timestampNote: true },
    });

    if (!annotation) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Annotation not found' } });
      return;
    }

    // Append to existing timestamps array
    const existing = (annotation.timestampNote as { time: number; note: string; severity: string }[]) || [];
    existing.push({ time: input.time, note: input.note, severity: input.severity });
    // Sort by time
    existing.sort((a, b) => a.time - b.time);

    await prisma.qaAnnotation.update({
      where: { id: annotationId as string },
      data: { timestampNote: existing },
    });

    res.json({ success: true, data: existing });
  } catch (err) {
    next(err);
  }
});

/** GET /qa-timestamps/call/:callLogId — get all timestamp annotations for a call */
router.get('/call/:callLogId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const annotations = await prisma.qaAnnotation.findMany({
      where: { callLogId: req.params.callLogId as string },
      select: { id: true, score: true, comment: true, timestampNote: true, reviewer: { select: { fullName: true } }, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: annotations });
  } catch (err) {
    next(err);
  }
});

/** POST /qa-timestamps/call/:callLogId/quick — create annotation + timestamp in one step */
router.post('/call/:callLogId/quick', requirePermission('view_recordings'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = timestampSchema.parse(req.body);
    const callLogId = req.params.callLogId as string;
    const reviewerId = req.user!.userId;

    // Find or create annotation for this call by this reviewer
    let annotation = await prisma.qaAnnotation.findFirst({
      where: { callLogId, reviewerId },
    });

    if (!annotation) {
      annotation = await prisma.qaAnnotation.create({
        data: { callLogId, reviewerId, score: 0, timestampNote: [] },
      });
    }

    // Append timestamp
    const existing = (annotation.timestampNote as { time: number; note: string; severity: string }[]) || [];
    existing.push({ time: input.time, note: input.note, severity: input.severity });
    existing.sort((a, b) => a.time - b.time);

    await prisma.qaAnnotation.update({
      where: { id: annotation.id },
      data: { timestampNote: existing },
    });

    res.json({ success: true, data: existing });
  } catch (err) {
    next(err);
  }
});

export default router;
