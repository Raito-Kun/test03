import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import redis from './redis';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`FATAL: ${name} env var is required`);
  return value;
}

const ACCESS_SECRET = getRequiredEnv('JWT_ACCESS_SECRET');
const ACCESS_TTL = '15m';
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface TokenPayload {
  userId: string;
  role: string;
  teamId: string | null;
}

/** Generate short-lived access token (15min) */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

/** Generate refresh token stored in Redis (7d) */
export async function generateRefreshToken(userId: string): Promise<string> {
  const tokenId = uuidv4();
  await redis.set(`refresh:${tokenId}`, userId, 'EX', REFRESH_TTL_SECONDS);
  return tokenId;
}

/** Verify access token — returns payload or throws */
export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
}

/**
 * Atomically consume refresh token (GETDEL).
 * Returns userId if valid, null if already consumed or expired.
 * Prevents race condition: only first request wins.
 */
export async function consumeRefreshToken(tokenId: string): Promise<string | null> {
  const userId = await redis.getdel(`refresh:${tokenId}`);
  return userId;
}

/** Invalidate a refresh token (for logout) */
export async function invalidateRefreshToken(tokenId: string): Promise<void> {
  await redis.del(`refresh:${tokenId}`);
}
