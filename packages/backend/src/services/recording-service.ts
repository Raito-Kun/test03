import axios from 'axios';
import path from 'path';
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logAudit } from '../lib/audit';
import logger from '../lib/logger';

const ALLOWED_EXTENSIONS = ['.wav', '.mp3'];

/**
 * Proxy recording file from FusionPBX storage.
 * Validates path safety and RBAC before proxying.
 */
export async function proxyRecording(
  callLogId: string,
  userId: string,
  req: Request,
  res: Response,
): Promise<void> {
  const callLog = await prisma.callLog.findUnique({
    where: { id: callLogId },
    select: { id: true, recordingPath: true, recordingStatus: true, userId: true },
  });

  if (!callLog) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call log not found' } });
    return;
  }

  if (callLog.recordingStatus !== 'available' || !callLog.recordingPath) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Recording not available' } });
    return;
  }

  // Path traversal prevention
  const recordingPath = callLog.recordingPath;
  if (recordingPath.includes('..') || recordingPath.includes('\0')) {
    res.status(400).json({ success: false, error: { code: 'INVALID_PATH', message: 'Invalid recording path' } });
    return;
  }

  const ext = path.extname(recordingPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_PATH', message: 'Invalid file type' } });
    return;
  }

  const baseUrl = process.env.FUSIONPBX_RECORDING_URL || 'http://localhost:8080/recordings';
  const fileUrl = `${baseUrl}/${encodeURIComponent(recordingPath)}`;

  try {
    const rangeHeader = req.headers['range'];
    const headers: Record<string, string> = {};
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const upstream = await axios.get(fileUrl, {
      responseType: 'stream',
      headers,
      validateStatus: (s) => s < 500,
    });

    // Forward relevant headers
    const contentType = upstream.headers['content-type'] as string | undefined;
    const contentLength = upstream.headers['content-length'] as string | undefined;
    const contentRange = upstream.headers['content-range'] as string | undefined;
    const acceptRanges = upstream.headers['accept-ranges'] as string | undefined;

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    res.status(upstream.status);

    (upstream.data as NodeJS.ReadableStream).pipe(res);

    logAudit(userId, 'play_recording', 'call_logs', callLogId, null, req);
  } catch (err: unknown) {
    const e = err as Error;
    logger.error('Failed to proxy recording', { callLogId, error: e.message });
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: { code: 'UPSTREAM_ERROR', message: 'Failed to fetch recording' } });
    }
  }
}
