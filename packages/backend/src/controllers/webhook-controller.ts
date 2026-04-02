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

/** Escape angle brackets in values that look like XML tags but aren't (SIP URIs, caller_id numbers) */
function escapeSipUris(xml: string): string {
  return xml
    // Escape <sip:...> or <sips:...> URIs
    .replace(/<(sips?:[^>\n]+)>/g, '&lt;$1&gt;')
    // Escape bare numbers in angle brackets like <1005> inside text content (e.g., caller_id)
    .replace(/>([^<]*)<(\d+)>([^<]*)</g, '>$1&lt;$2&gt;$3<');
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

    // Agent extension from dialed_user or origination caller; fallback to callflow for B-legs
    const callerNum = safeStr(
      variables['caller_id_number'] || variables['effective_caller_id_number'] || variables['origination_caller_id_number'] || ''
    ) || safeStr((callflow?.['caller_profile'] as Record<string, unknown> | undefined)?.['caller_id_number'] || '');

    // Use call_direction (set by FusionPBX) over channel direction
    const direction = String(variables['call_direction'] || variables['direction'] || 'outbound');

    // Timing: prefer variables, fallback to callflow (B-legs/self-call legs store timing in callflow)
    const cfTimes = (callflow || {}) as Record<string, unknown>;
    const startEpoch = variables['start_epoch'] ? Number(variables['start_epoch']) : (cfTimes['start_epoch'] ? Number(cfTimes['start_epoch']) : null);
    const answerEpoch = variables['answer_epoch'] ? Number(variables['answer_epoch']) : (cfTimes['answer_epoch'] ? Number(cfTimes['answer_epoch']) : null);
    const endEpoch = variables['end_epoch'] ? Number(variables['end_epoch']) : (cfTimes['end_epoch'] ? Number(cfTimes['end_epoch']) : null);
    const duration = Number(variables['duration'] || cfTimes['duration'] || cdr['duration'] || 0);
    const billsec = Number(variables['billsec'] || cfTimes['billsec'] || cdr['billsec'] || 0);
    const hangupCause = safeStr(variables['hangup_cause'] || variables['last_bridge_hangup_cause'] || '');
    let sipCode = safeStr(variables['sip_term_status'] || variables['last_bridge_proto_specific_hangup_cause'] || '').replace(/^sip:/, '');
    const sipReason = safeStr(variables['sip_hangup_disposition'] || variables['sip_invite_failure_phrase'] || '');
    // Derive missing sipCode from hangupCause per RFC 3261
    if (!sipCode && hangupCause === 'ORIGINATOR_CANCEL') sipCode = '487';
    if (!sipCode && hangupCause === 'NO_ANSWER') sipCode = '480';
    if (!sipCode && hangupCause === 'USER_BUSY') sipCode = '486';
    if (!sipCode && hangupCause === 'CALL_REJECTED') sipCode = '403';
    if (!sipCode && hangupCause === 'UNALLOCATED_NUMBER') sipCode = '404';
    if (!sipCode && hangupCause === 'NORMAL_CLEARING' && billsec > 0) sipCode = '200';
    // Call source tag set by CRM during origination (c2c, autocall, etc.)
    const callSource = safeStr(variables['crm_call_source'] || '');
    const callerProfile = callflow?.['caller_profile'] as Record<string, unknown> | undefined;

    // Build recording path from record_path + record_name
    const recordDir = safeStr(variables['record_path'] || '');
    const recordName = safeStr(variables['record_name'] || '');
    const recordingPath = recordDir && recordName
      ? `${recordDir}/${recordName}`
      : safeStr(variables['recording_path'] || '') || null;

    const domain = process.env.FUSIONPBX_DOMAIN || 'crm';

    // Normalize destination BEFORE junk check: strip domain, add leading 0 for VN numbers
    const rawDest = destNum === domain ? '' : destNum;
    const finalDest = rawDest && /^\d{9}$/.test(rawDest) ? `0${rawDest}` : rawDest;

    // Dedup: 1 physical call = 1 row in call_logs.
    // FusionPBX sends 2-3 CDR legs per call (originate, loopback, external trunk).
    const isExtension = (n: string) => /^\d{1,4}$/.test(n);
    const channelName = safeStr(variables['channel_name'] || '');
    const isInternalLeg = isExtension(callerNum) && isExtension(finalDest) && callerNum !== finalDest;
    // sofia/internal/* = agent SIP phone leg — billsec includes routing/IVR time, always inflated. Skip entirely.
    const isAgentSipLeg = channelName.startsWith('sofia/internal/');

    // Canonical UUID: merge all CDR legs into 1 record.
    // FusionPBX loopback legs cross-reference each other via other_loopback_leg_uuid,
    // so that field is only useful when the leg HAS a destination (it's the "good" leg).
    // Empty-dest legs always use time-window search to find an existing record to merge into.
    let canonicalUuid = '';

    if (finalDest) {
      // Leg with destination: use loopback link or fallback UUID
      const loopbackPairUuid = safeStr(variables['other_loopback_leg_uuid'] || '');
      const fallbackOriginUuid = safeStr(
        variables['ent_originate_aleg_uuid'] || variables['originating_leg_uuid'] || variables['originator'] || ''
      );
      canonicalUuid = loopbackPairUuid || (fallbackOriginUuid !== callUuid ? fallbackOriginUuid : '') || callUuid;
    }

    // Time-window search: for empty-dest legs (always) or as fallback for dest legs
    if (!canonicalUuid || !finalDest) {
      const windowStart = startEpoch ? new Date((startEpoch - 60) * 1000) : new Date(Date.now() - 120_000);
      const windowEnd = startEpoch ? new Date((startEpoch + 60) * 1000) : new Date(Date.now() + 60_000);
      const searchConditions = finalDest
        ? [
            { callerNumber: callerNum, destinationNumber: finalDest },
            { callerNumber: callerNum, destinationNumber: finalDest.replace(/^0/, '') },
          ]
        : [
            // Empty-dest legs: match any recent record from same agent extension or by trunk caller
            ...(isExtension(callerNum) ? [{ callerNumber: callerNum }] : []),
            // External trunk legs (caller=88801640 etc): search by destination from callflow
            ...(channelName.startsWith('sofia/external/') ? (() => {
              const extDest = channelName.replace('sofia/external/', '').split('@')[0];
              const normDest = /^\d{9}$/.test(extDest) ? `0${extDest}` : extDest;
              return normDest ? [{ destinationNumber: normDest }, { destinationNumber: extDest }] : [];
            })() : []),
          ];
      if (searchConditions.length > 0) {
        const existing = await prisma.callLog.findFirst({
          where: { startTime: { gte: windowStart, lte: windowEnd }, OR: searchConditions },
          select: { callUuid: true },
          orderBy: { startTime: 'desc' },
        });
        if (existing) canonicalUuid = existing.callUuid;
      }
    }

    // Legs with no destination and no existing record to merge into → skip
    if (!finalDest && !canonicalUuid) {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: 'processed', errorMessage: 'Skipped orphan leg (no dest, no match)' },
      });
      res.json({ success: true, data: null });
      return;
    }
    // Internal ext→ext legs → skip
    if (isInternalLeg) {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: 'processed', errorMessage: 'Skipped internal ext-to-ext leg' },
      });
      res.json({ success: true, data: null });
      return;
    }
    // Agent SIP phone leg (sofia/internal/*) → skip — billsec is inflated (includes routing time)
    if (isAgentSipLeg) {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: 'processed', errorMessage: 'Skipped agent SIP leg (inflated timing)' },
      });
      res.json({ success: true, data: null });
      return;
    }
    // Use own UUID if no canonical found (first leg for this call)
    if (!canonicalUuid) canonicalUuid = callUuid;

    logger.info('CDR leg analysis [v6]', { callUuid, canonicalUuid, callerNum, finalDest, billsec, duration, hasDest: !!finalDest, mergeOnly: !finalDest });

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

    // For self-call legs (e.g., canonical originate leg with real billsec), merge timing
    // Don't return early — let it fall through to the upsert so data is always persisted

    // Upsert call log — merge multiple CDR legs into 1 record using canonical UUID
    // Fetch existing record to keep MAX of billsec/duration across legs
    const existingRecord = await prisma.callLog.findUnique({
      where: { callUuid: canonicalUuid },
      select: { duration: true, billsec: true, hangupCause: true, sipCode: true },
    });
    const bestDuration = Math.max(duration, existingRecord?.duration || 0);
    const bestBillsec = Math.max(billsec, existingRecord?.billsec || 0);

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
        duration: bestDuration,
        billsec: bestBillsec,
        hangupCause: hangupCause || null,
        sipCode: sipCode || null,
        sipReason: sipReason || null,
        recordingPath: hasRecording ? String(recordingPath) : null,
        recordingStatus: hasRecording ? 'available' : 'none',
        ...(callSource ? { notes: callSource } : {}),
      },
      update: {
        // Merge from multiple legs — only override with better data
        ...(agentUserId ? { userId: agentUserId } : {}),
        ...(callSource ? { notes: callSource } : {}),
        ...(contactId ? { contactId } : {}),
        ...(callerNum ? { callerNumber: callerNum } : {}),
        ...(finalDest ? { destinationNumber: finalDest } : {}),
        ...(answerTime ? { answerTime } : {}),
        ...(endTime ? { endTime } : {}),
        // Always use MAX of existing vs incoming to prevent short legs overwriting real talk time
        duration: bestDuration,
        billsec: bestBillsec,
        // Only update SIP fields if existing record has no sipCode yet (prevent cross-leg conflicts)
        ...(!existingRecord?.sipCode && hangupCause ? { hangupCause } : {}),
        ...(!existingRecord?.sipCode && sipCode ? { sipCode } : {}),
        ...(!existingRecord?.sipCode && sipReason ? { sipReason } : {}),
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
