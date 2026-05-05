import axios from 'axios';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logAudit } from '../lib/audit';
import logger from '../lib/logger';

const ALLOWED_EXTENSIONS = ['.wav', '.mp3'];
const MIME_MAP: Record<string, string> = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };

// Local recordings directory (populated by rsync from FusionPBX)
const LOCAL_RECORDING_DIR = process.env.LOCAL_RECORDING_DIR || '';

const BULK_DOWNLOAD_LIMIT = 50;

/**
 * Build a human-friendly filename for a recording download:
 *   {direction}_{caller}_{destination}_{dd-mm-yyyy_HH-MM-SS}.{ext}
 * Mirrors frontend buildRecordingFilename so the name is consistent
 * whether the user uses the <a download> link or the audio player's
 * "Save audio as..." (which honors the server's Content-Disposition).
 */
function buildRecordingFilename(
  direction: string,
  callerNumber: string,
  destinationNumber: string,
  startTime: Date,
  ext: string,
): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const stamp =
    `${pad(startTime.getDate())}-${pad(startTime.getMonth() + 1)}-${startTime.getFullYear()}` +
    `_${pad(startTime.getHours())}-${pad(startTime.getMinutes())}-${pad(startTime.getSeconds())}`;
  const sanitize = (s: string) => (s || '').replace(/[^A-Za-z0-9_+-]/g, '') || 'unknown';
  const cleanExt = ext.replace(/^\./, '') || 'mp3';
  return `${sanitize(direction)}_${sanitize(callerNumber)}_${sanitize(destinationNumber)}_${stamp}.${cleanExt}`;
}

/**
 * Bulk download recordings as a zip archive.
 * Accepts array of callLogIds (max 50).
 */
export async function bulkDownloadRecordings(
  callLogIds: string[],
  userId: string,
  req: Request,
  res: Response,
): Promise<void> {
  if (callLogIds.length === 0) {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'No callLogIds provided' } });
    return;
  }

  if (callLogIds.length > BULK_DOWNLOAD_LIMIT) {
    res.status(400).json({
      success: false,
      error: { code: 'LIMIT_EXCEEDED', message: `Maximum ${BULK_DOWNLOAD_LIMIT} recordings per request` },
    });
    return;
  }

  const callLogs = await prisma.callLog.findMany({
    where: { id: { in: callLogIds }, recordingStatus: 'available', recordingPath: { not: null } },
    select: {
      id: true,
      recordingPath: true,
      callUuid: true,
      direction: true,
      callerNumber: true,
      destinationNumber: true,
      startTime: true,
    },
  });

  if (callLogs.length === 0) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No available recordings found' } });
    return;
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="recordings_${Date.now()}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  for (const log of callLogs) {
    const recordingPath = log.recordingPath!;
    if (recordingPath.includes('..') || recordingPath.includes('\0')) continue;

    const ext = path.extname(recordingPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) continue;

    const relativePath = recordingPath.replace(/^\/var\/lib\/freeswitch\/recordings\/?/, '');
    const fileName = buildRecordingFilename(
      log.direction,
      log.callerNumber,
      log.destinationNumber,
      log.startTime,
      ext,
    );

    if (LOCAL_RECORDING_DIR) {
      const localFile = path.join(LOCAL_RECORDING_DIR, relativePath);
      const resolved = path.resolve(localFile);
      if (resolved.startsWith(path.resolve(LOCAL_RECORDING_DIR)) && fs.existsSync(resolved)) {
        archive.file(resolved, { name: fileName });
        continue;
      }
    }

    // Fallback: fetch from upstream and stream into zip
    try {
      const baseUrl = process.env.FUSIONPBX_RECORDING_URL || 'http://localhost:8080/recordings';
      const safePath = relativePath.split('/').map((seg) => encodeURIComponent(seg)).join('/');
      const upstream = await axios.get(`${baseUrl}/${safePath}`, { responseType: 'stream', validateStatus: (s) => s < 500 });
      if (upstream.status < 400) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        archive.append(upstream.data as any, { name: fileName });
      }
    } catch (err) {
      logger.warn('Bulk download: failed to fetch recording', { callLogId: log.id, error: (err as Error).message });
    }
  }

  archive.on('error', (err) => {
    logger.error('Zip archive error', { error: err.message });
  });

  await archive.finalize();
  logAudit(userId, 'download', 'call_logs', callLogIds.join(','), { count: callLogs.length }, req);
}

/**
 * Proxy recording file — serve from local rsync'd directory first,
 * fallback to upstream FusionPBX HTTP proxy.
 */
export async function proxyRecording(
  callLogId: string,
  userId: string,
  req: Request,
  res: Response,
): Promise<void> {
  const callLog = await prisma.callLog.findUnique({
    where: { id: callLogId },
    select: {
      id: true,
      recordingPath: true,
      recordingStatus: true,
      userId: true,
      direction: true,
      callerNumber: true,
      destinationNumber: true,
      startTime: true,
      cluster: { select: { recordingUrlPrefix: true } },
    },
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

  // Strip absolute filesystem prefix to get relative path
  const relativePath = recordingPath.replace(/^\/var\/lib\/freeswitch\/recordings\/?/, '');

  const downloadName = buildRecordingFilename(
    callLog.direction,
    callLog.callerNumber,
    callLog.destinationNumber,
    callLog.startTime,
    ext,
  );

  logger.info('Recording lookup', {
    callLogId,
    recordingPath,
    relativePath,
    localDir: LOCAL_RECORDING_DIR || '(not set)',
  });

  // Try local file first (rsync'd from FusionPBX)
  if (LOCAL_RECORDING_DIR) {
    const localFile = path.join(LOCAL_RECORDING_DIR, relativePath);
    // Extra safety: ensure resolved path stays inside LOCAL_RECORDING_DIR
    const resolved = path.resolve(localFile);
    if (resolved.startsWith(path.resolve(LOCAL_RECORDING_DIR)) && fs.existsSync(resolved)) {
      logger.info('Serving recording from local', { callLogId, resolved });
      serveLocalFile(resolved, ext, downloadName, callLogId, userId, req, res);
      return;
    }
    logger.warn('Local recording not found', { callLogId, localFile: resolved });
  }

  // Fallback: proxy from upstream FusionPBX (prefer cluster-specific URL when set)
  const baseUrl = callLog.cluster?.recordingUrlPrefix
    || process.env.FUSIONPBX_RECORDING_URL
    || 'http://localhost:8080/recordings';
  logger.info('Proxying recording from upstream', { callLogId, relativePath, baseUrl });
  await proxyFromUpstream(baseUrl, relativePath, ext, downloadName, callLogId, userId, req, res);
}

/** Format a Content-Disposition header safely for ASCII + UTF-8 filenames (RFC 5987). */
function contentDisposition(kind: 'inline' | 'attachment', filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  const encoded = encodeURIComponent(filename);
  return `${kind}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/** Serve recording from local filesystem with range request support */
function serveLocalFile(
  filePath: string,
  ext: string,
  downloadName: string,
  callLogId: string,
  userId: string,
  req: Request,
  res: Response,
): void {
  const stat = fs.statSync(filePath);
  const mimeType = MIME_MAP[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', contentDisposition('inline', downloadName));

  const rangeHeader = req.headers['range'];
  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', end - start + 1);
    res.status(206);
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', stat.size);
    res.status(200);
    fs.createReadStream(filePath).pipe(res);
  }

  logAudit(userId, 'play_recording', 'call_logs', callLogId, null, req);
}

/** Proxy recording from upstream FusionPBX HTTP server */
async function proxyFromUpstream(
  baseUrl: string,
  relativePath: string,
  ext: string,
  downloadName: string,
  callLogId: string,
  userId: string,
  req: Request,
  res: Response,
): Promise<void> {
  const safePath = relativePath.split('/').map((seg) => encodeURIComponent(seg)).join('/');
  const fileUrl = `${baseUrl}/${safePath}`;

  try {
    const rangeHeader = req.headers['range'];
    const headers: Record<string, string> = {};
    if (rangeHeader) headers['Range'] = rangeHeader;

    const upstream = await axios.get(fileUrl, {
      responseType: 'stream',
      headers,
      validateStatus: (s) => s < 500,
    });

    if (upstream.status >= 400) {
      logger.error('Upstream recording error', { callLogId, fileUrl, status: upstream.status });
      res.status(upstream.status).json({
        success: false,
        error: { code: 'RECORDING_NOT_FOUND', message: `Recording file not accessible (HTTP ${upstream.status})` },
      });
      return;
    }

    const mimeType = MIME_MAP[ext] || 'application/octet-stream';
    const contentLength = upstream.headers['content-length'] as string | undefined;
    const contentRange = upstream.headers['content-range'] as string | undefined;

    res.setHeader('Content-Type', mimeType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    res.setHeader('Accept-Ranges', 'bytes');

    res.setHeader('Content-Disposition', contentDisposition('inline', downloadName));
    res.status(upstream.status);

    (upstream.data as NodeJS.ReadableStream).pipe(res);
    logAudit(userId, 'play_recording', 'call_logs', callLogId, null, req);
  } catch (err: unknown) {
    const e = err as Error;
    logger.error('Failed to proxy recording', { callLogId, fileUrl, error: e.message });
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: { code: 'UPSTREAM_ERROR', message: 'Failed to fetch recording from storage' } });
    }
  }
}
