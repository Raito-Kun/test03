import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/auth-middleware';
import * as aiService from '../services/ai-service';

const router = Router();

// AI rate limit: 5 req/min per user
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many AI requests' } },
});

router.use(authMiddleware);
router.use(aiLimiter);

/** POST /ai/chat — Streaming AI chat */
router.post('/chat', async (req: Request, res: Response) => {
  const { context = '', message } = req.body;
  if (!message) {
    res.status(400).json({ success: false, error: { message: 'Message required' } });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  for await (const chunk of aiService.chatStream(context, message)) {
    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

/** POST /ai/summarize — Customer 360 summary */
router.post('/summarize', async (req: Request, res: Response) => {
  const { customerData } = req.body;
  if (!customerData) {
    res.status(400).json({ success: false, error: { message: 'Customer data required' } });
    return;
  }

  const summary = await aiService.summarizeCustomer(customerData);
  res.json({ success: true, data: { summary } });
});

/** POST /ai/score-lead — AI lead scoring */
router.post('/score-lead', async (req: Request, res: Response) => {
  const { leadData } = req.body;
  if (!leadData) {
    res.status(400).json({ success: false, error: { message: 'Lead data required' } });
    return;
  }

  const result = await aiService.scoreLead(leadData);
  res.json({ success: true, data: result });
});

/** POST /ai/suggest-disposition — Post-call disposition suggestion */
router.post('/suggest-disposition', async (req: Request, res: Response) => {
  const { callData } = req.body;
  if (!callData) {
    res.status(400).json({ success: false, error: { message: 'Call data required' } });
    return;
  }

  const result = await aiService.suggestDisposition(callData);
  res.json({ success: true, data: result });
});

/** POST /ai/coaching — Real-time call coaching */
router.post('/coaching', async (req: Request, res: Response) => {
  const { callContext } = req.body;
  if (!callContext) {
    res.status(400).json({ success: false, error: { message: 'Call context required' } });
    return;
  }

  const suggestion = await aiService.getCoachingSuggestion(callContext);
  res.json({ success: true, data: { suggestion } });
});

/** GET /ai/anomalies — Detect performance anomalies */
router.get('/anomalies', async (req: Request, res: Response) => {
  const { metricsData = '{}' } = req.query;
  const anomalies = await aiService.detectAnomalies(String(metricsData));
  res.json({ success: true, data: anomalies });
});

export default router;
