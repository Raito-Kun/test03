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
  stopNodes: [
    'cdr.variables.rtp_local_sdp_str',
    'cdr.variables.switch_r_sdp',
    'cdr.variables.sip_outgoing_contact_uri',
    'cdr.variables.sip_recover_contact',
    'cdr.variables.sip_full_from',
    'cdr.variables.sip_full_to',
    'cdr.variables.sip_contact_uri',
    'cdr.variables.sip_full_via',
    'cdr.variables.sip_recover_via',
    'cdr.variables.sofia_profile_url',
  ],
});

/** Escape angle brackets in SIP URIs inside variable values to prevent XML parser confusion */
function escapeSipUris(xml: string): string {
  // Match <sip:...> or <sips:...> that appear INSIDE XML text content (after > and before </)
  return xml.replace(/<(sips?:[^>\n]+)>/g, '&lt;$1&gt;');
}

/** POST /webhooks/cdr */
export async function handleCdr(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Debug: log what we receive
    const bodyType = typeof req.body;
    const bodyPreview = typeof req.body === 'string' ? req.body.substring(0, 200) : JSON.stringify(req.body).substring(0, 200);
    logger.info('CDR webhook received', { ip: req.ip, contentType: req.headers['content-type'], bodyType, bodyPreview, authPresent: !!req.headers.authorization });

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

    // mod_xml_cdr sends as form-urlencoded with 'cdr' field, or raw XML
    const rawBody = typeof req.body === 'object' && req.body.cdr
      ? req.body.cdr as string
      : req.body as string;

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
        const sanitizedXml = escapeSipUris(rawBody);
        parsed = xmlParser.parse(sanitizedXml) as Record<string, unknown>;
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

    const safeStr = (v: unknown): string => {
      if (!v) return '';
      const s = String(v);
      try { return decodeURIComponent(s); } catch { return s; }
    };

    const callUuid = String(variables['uuid'] || variables['call_uuid'] || '');

    // Extract destination from bridge data or caller_destination
    const bridgeData = safeStr(variables['current_application_data'] || '');
    const destFromBridge = bridgeData.includes('/') ? bridgeData.split('/').pop() || '' : '';
    const destNum = safeStr(
      variables['destination_number'] || variables['caller_destination'] || variables['callee_id_number'] || ''
    ) || destFromBridge;

    // Agent extension from dialed_user or origination caller
    const callerNum = safeStr(
      variables['caller_id_number'] || variables['effective_caller_id_number'] || variables['origination_caller_id_number'] || ''
    );

    // Use call_direction (set by FusionPBX) over channel direction
    const direction = String(variables['call_direction'] || variables['direction'] || 'outbound');

    const startEpoch = variables['start_epoch'] ? Number(variables['start_epoch']) : null;
    const answerEpoch = variables['answer_epoch'] ? Number(variables['answer_epoch']) : null;
    const endEpoch = variables['end_epoch'] ? Number(variables['end_epoch']) : null;
    const duration = Number(variables['duration'] || 0);
    const billsec = Number(variables['billsec'] || 0);
    const hangupCause = safeStr(variables['hangup_cause'] || variables['last_bridge_hangup_cause'] || '');
    const sipCode = safeStr(variables['sip_term_status'] || variables['last_bridge_proto_specific_hangup_cause'] || '').replace(/^sip:/, '');
    const sipReason = safeStr(variables['sip_hangup_disposition'] || variables['sip_invite_failure_phrase'] || '');
    const callerProfile = callflow?.['caller_profile'] as Record<string, unknown> | undefined;

    // Build recording path from record_path + record_name
    const recordDir = safeStr(variables['record_path'] || '');
    const recordName = safeStr(variables['record_name'] || '');
    const recordingPath = recordDir && recordName
      ? `${recordDir}/${recordName}`
      : safeStr(variables['recording_path'] || '') || null;

    // Use originate UUID to group all legs under 1 call record
    const originateFromUuid = safeStr(variables['other_loopback_from_uuid'] || variables['ent_originate_aleg_uuid'] || '');
    const domain = process.env.FUSIONPBX_DOMAIN || 'crm';

    // Skip junk legs: no caller+dest, or dest is just the domain name
    const isJunkLeg = (!callerNum && !destNum) || destNum === domain || destNum === '1005' && callerNum === '1005';
    if (isJunkLeg && !recordingPath) {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: 'processed', errorMessage: 'Skipped junk leg' },
      });
      res.json({ success: true, data: null });
      return;
    }

    // Use the originate UUID as the canonical callUuid so all legs merge into 1 record
    const canonicalUuid = originateFromUuid || callUuid;

    if (!canonicalUuid) {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: 'failed', errorMessage: 'Missing call UUID' },
      });
      res.status(400).json({ success: false, error: { code: 'MISSING_UUID', message: 'Call UUID required' } });
      return;
    }

    // Normalize destination: skip domain name, add leading 0 for Vietnamese numbers
    const rawDest = destNum === domain ? '' : destNum;
    const finalDest = rawDest && /^\d{9}$/.test(rawDest) ? `0${rawDest}` : rawDest;

    // Match contact by customer phone number
    const phoneToMatch = direction === 'inbound' ? callerNum : finalDest;
    let contactId: string | null = null;
    if (phoneToMatch && phoneToMatch.length >= 5) {
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

    // Map agent extension → userId so dashboard/scope filtering works
    const agentExt = direction === 'outbound' ? callerNum : (direction === 'inbound' ? finalDest : '');
    let agentUserId: string | null = null;
    if (agentExt && agentExt.length <= 6) {
      const agent = await prisma.user.findFirst({
        where: { sipExtension: agentExt, status: 'active' },
        select: { id: true },
      });
      agentUserId = agent?.id || null;
    }

    // Only mark recording as available if call had actual talk time (billsec > 0)
    const hasRecording = recordingPath && recordingPath !== 'null' && billsec > 0;

    // Upsert call log — merge multiple CDR legs into 1 record using canonical UUID
    const startTime = startEpoch ? new Date(startEpoch * 1000) : new Date();
    const answerTime = answerEpoch ? new Date(answerEpoch * 1000) : null;
    const endTime = endEpoch ? new Date(endEpoch * 1000) : null;
    await prisma.callLog.upsert({
      where: { callUuid: canonicalUuid },
      create: {
        callUuid: canonicalUuid,
        contactId,
        userId: agentUserId,
        direction: direction === 'inbound' ? 'inbound' : 'outbound',
        callerNumber: callerNum,
        destinationNumber: finalDest,
        startTime,
        answerTime,
        endTime,
        duration,
        billsec,
        hangupCause: hangupCause || null,
        sipCode: sipCode || null,
        sipReason: sipReason || null,
        recordingPath: hasRecording ? String(recordingPath) : null,
        recordingStatus: hasRecording ? 'available' : 'none',
      },
      update: {
        // Merge from multiple legs — only override with better data
        ...(agentUserId ? { userId: agentUserId } : {}),
        ...(contactId ? { contactId } : {}),
        ...(callerNum ? { callerNumber: callerNum } : {}),
        ...(finalDest ? { destinationNumber: finalDest } : {}),
        ...(answerTime ? { answerTime } : {}),
        ...(endTime ? { endTime } : {}),
        ...(duration > 0 ? { duration } : {}),
        ...(billsec > 0 ? { billsec } : {}),
        ...(hangupCause ? { hangupCause } : {}),
        ...(sipCode ? { sipCode } : {}),
        ...(sipReason ? { sipReason } : {}),
        ...(hasRecording ? { recordingPath: String(recordingPath), recordingStatus: 'available' as const } : {}),
      },
    });

    await prisma.webhookLog.update({
      where: { id: webhookLog.id },
      data: {
        callUuid: canonicalUuid,
        status: 'processed',
        processedAt: new Date(),
      },
    });

    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
