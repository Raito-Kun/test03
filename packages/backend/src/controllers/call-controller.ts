import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as eslService from '../services/esl-service';
import * as agentStatusService from '../services/agent-status-service';
import * as recordingService from '../services/recording-service';
import prisma from '../lib/prisma';

const originateSchema = z.object({
  phone: z.string().min(1).max(30).optional(),
  destinationNumber: z.string().min(1).max(30).optional(),
  callerId: z.string().min(1).max(30).optional(),
});

const hangupSchema = z.object({
  callUuid: z.string().uuid(),
});

const holdSchema = z.object({
  callUuid: z.string().uuid(),
});

const transferSchema = z.object({
  callUuid: z.string().uuid(),
  targetExtension: z.string().min(1).max(30),
});

/** POST /calls/originate */
export async function originateCall(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = originateSchema.parse(req.body);
    const userId = req.user!.userId;
    const destination = input.phone || input.destinationNumber;

    if (!destination) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Phone number required' } });
      return;
    }

    // Fetch agent's SIP extension
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { sipExtension: true },
    });

    if (!user?.sipExtension) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_EXTENSION', message: 'Agent has no SIP extension configured' },
      });
      return;
    }

    const callerId = input.callerId || user.sipExtension;
    await eslService.originate(user.sipExtension, destination, callerId);

    res.status(202).json({ success: true, data: { message: 'Call origination initiated' } });
  } catch (err) {
    next(err);
  }
}

/** POST /calls/hangup */
export async function hangupCall(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = hangupSchema.parse(req.body);
    await eslService.hangup(input.callUuid);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

/** POST /calls/hold */
export async function holdCall(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = holdSchema.parse(req.body);
    await eslService.hold(input.callUuid);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

/** POST /calls/transfer */
export async function transferCall(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = transferSchema.parse(req.body);
    await eslService.transfer(input.callUuid, input.targetExtension);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

/** GET /call-logs/:id/recording */
export async function getRecording(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    await recordingService.proxyRecording(id, req.user!.userId, req, res);
  } catch (err) {
    next(err);
  }
}
