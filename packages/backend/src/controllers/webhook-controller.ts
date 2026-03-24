import { Request, Response, NextFunction } from 'express';
import { XMLParser } from 'fast-xml-parser';
import prisma from '../lib/prisma';
import { normalizePhone } from '../lib/phone-utils';
import logger from '../lib/logger';

const ALLOWED_IPS = (process.env.WEBHOOK_ALLOWED_IPS || '127.0.0.1').split(',').map((s) => s.trim());
const WEBHOOK_USER = process.env.WEBHOOK_BASIC_USER || 'webhook';
const WEBHOOK_PASS = process.env.WEBHOOK_BASIC_PASS || 'webhook_secret';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  processEntities: false, // XXE prevention
  allowBooleanAttributes: true,
});

/** POST /webhooks/cdr */
export async function handleCdr(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // IP whitelist — use req.ip, NOT x-forwarded-for
    const clientIp = req.ip || '';
    if (!ALLOWED_IPS.includes(clientIp) && !ALLOWED_IPS.includes('0.0.0.0')) {
      logger.warn('CDR webhook rejected: IP not whitelisted', { ip: clientIp });
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'IP not allowed' } });
      return;
    }

    // Basic Auth verification
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Basic ')) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
      return;
    }
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const [user, pass] = credentials.split(':');
    if (user !== WEBHOOK_USER || pass !== WEBHOOK_PASS) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
      return;
    }

    const rawBody = req.body as string;

    // Log webhook receipt
    const webhookLog = await prisma.webhookLog.create({
      data: {
        source: 'fusionpbx_cdr',
        rawPayload: typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody),
        status: 'received',
      },
    });

    let parsed: Record<string, unknown>;
    try {
      if (typeof rawBody === 'string') {
        parsed = xmlParser.parse(rawBody) as Record<string, unknown>;
      } else {
        parsed = rawBody as Record<string, unknown>;
      }
    } catch (parseErr) {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: 'failed', errorMessage: 'XML parse error' },
      });
      res.status(400).json({ success: false, error: { code: 'PARSE_ERROR', message: 'Invalid XML' } });
      return;
    }

    // Extract CDR fields (FusionPBX format)
    const cdr = (parsed['cdr'] || parsed) as Record<string, unknown>;
    const variables = (cdr['variables'] || {}) as Record<string, unknown>;
    const callflow = Array.isArray(cdr['callflow'])
      ? (cdr['callflow'] as Record<string, unknown>[])[0]
      : (cdr['callflow'] as Record<string, unknown> | undefined);

    const callUuid = String(variables['uuid'] || variables['call_uuid'] || '');
    const direction = String(variables['direction'] || 'outbound');
    const callerNum = String(variables['caller_id_number'] || variables['caller_number'] || '');
    const destNum = String(variables['destination_number'] || '');
    const startEpoch = variables['start_epoch'] ? Number(variables['start_epoch']) : null;
    const answerEpoch = variables['answer_epoch'] ? Number(variables['answer_epoch']) : null;
    const endEpoch = variables['end_epoch'] ? Number(variables['end_epoch']) : null;
    const duration = Number(variables['duration'] || 0);
    const billsec = Number(variables['billsec'] || 0);
    const hangupCause = String(variables['hangup_cause'] || '');
    const callerProfile = callflow?.['caller_profile'] as Record<string, unknown> | undefined;
    const recordingPath = String(
      variables['recording_path'] || variables['record_name'] || callerProfile?.['rdnis'] || ''
    ) || null;

    if (!callUuid) {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: 'failed', errorMessage: 'Missing call UUID' },
      });
      res.status(400).json({ success: false, error: { code: 'MISSING_UUID', message: 'Call UUID required' } });
      return;
    }

    // Match contact by phone
    const phoneToMatch = direction === 'inbound' ? callerNum : destNum;
    let contactId: string | null = null;
    if (phoneToMatch) {
      const normalized = normalizePhone(phoneToMatch);
      const contact = await prisma.contact.findFirst({
        where: {
          OR: [
            { phone: phoneToMatch },
            { phone: normalized },
            { phoneAlt: phoneToMatch },
            { phoneAlt: normalized },
          ],
        },
        select: { id: true },
      });
      contactId = contact?.id || null;
    }

    const hasRecording = recordingPath && recordingPath !== 'null';

    // Upsert call log
    await prisma.callLog.upsert({
      where: { callUuid },
      create: {
        callUuid,
        contactId,
        direction: direction === 'inbound' ? 'inbound' : 'outbound',
        callerNumber: callerNum,
        destinationNumber: destNum,
        startTime: startEpoch ? new Date(startEpoch * 1000) : new Date(),
        answerTime: answerEpoch ? new Date(answerEpoch * 1000) : null,
        endTime: endEpoch ? new Date(endEpoch * 1000) : null,
        duration,
        billsec,
        hangupCause: hangupCause || null,
        recordingPath: hasRecording ? String(recordingPath) : null,
        recordingStatus: hasRecording ? 'available' : 'none',
      },
      update: {
        contactId: contactId || undefined,
        answerTime: answerEpoch ? new Date(answerEpoch * 1000) : undefined,
        endTime: endEpoch ? new Date(endEpoch * 1000) : undefined,
        duration,
        billsec,
        hangupCause: hangupCause || null,
        recordingPath: hasRecording ? String(recordingPath) : null,
        recordingStatus: hasRecording ? 'available' : 'none',
      },
    });

    await prisma.webhookLog.update({
      where: { id: webhookLog.id },
      data: {
        callUuid,
        status: 'processed',
        processedAt: new Date(),
      },
    });

    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
