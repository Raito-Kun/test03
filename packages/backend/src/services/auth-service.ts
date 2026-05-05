import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import {
  generateAccessToken,
  generateRefreshToken,
  consumeRefreshToken,
  invalidateRefreshToken,
  TokenPayload,
} from '../lib/jwt';
import logger from '../lib/logger';
import { getPermissionsForRole } from './permission-service';

// Grace window (seconds) during which concurrent /refresh calls for the same
// refresh-token id replay the same new token pair. Prevents cross-tab logout.
const REFRESH_REPLAY_TTL = 10;
const REFRESH_RACE_WAIT_MS = 250;

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  teamId: string | null;
  sipExtension: string | null;
  callMode: string;
  mustChangePassword: boolean;
  unreadNotificationCount: number;
  permissions: string[];
}

/** Authenticate user with email + password, return token pair */
export async function login(email: string, password: string): Promise<{ tokens: AuthTokens; user: UserProfile }> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), { code: 'INVALID_CREDENTIALS' });
  }

  if (user.status === 'inactive') {
    throw Object.assign(new Error('Account is inactive'), { code: 'ACCOUNT_INACTIVE' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw Object.assign(new Error('Invalid email or password'), { code: 'INVALID_CREDENTIALS' });
  }

  const payload: TokenPayload = {
    userId: user.id,
    role: user.role,
    teamId: user.teamId,
    clusterId: user.clusterId,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(user.id);

  const [unreadCount, permissions] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    getPermissionsForRole(user.role, user.clusterId),
  ]);

  logger.info('User logged in', { userId: user.id, role: user.role });

  // Source of truth for UI extension chip: `user.extension` (cluster account mapping).
  // `sipExtension` is legacy/softphone-only and may hold stale values; prefer extension.
  const effectiveExtension = user.extension ?? null;

  return {
    tokens: { accessToken, refreshToken },
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      teamId: user.teamId,
      sipExtension: effectiveExtension,
      callMode: user.callMode,
      mustChangePassword: user.mustChangePassword,
      unreadNotificationCount: unreadCount,
      permissions,
    },
  };
}

/**
 * Refresh tokens.
 *
 * Fixes cross-tab logout: when the same browser has multiple tabs open, all
 * tabs share the refresh cookie and will hit /auth/refresh concurrently when
 * the access token expires. The old "GETDEL, only first wins" logic forced
 * N-1 tabs to hard-logout. We now cache the freshly-issued pair for
 * REFRESH_REPLAY_TTL seconds keyed by the consumed refresh-token id, so
 * losers of the race can replay the same pair.
 */
export async function refresh(refreshTokenId: string): Promise<AuthTokens> {
  const replayKey = `refresh:replay:${refreshTokenId}`;

  // Fast path — a sibling tab already resolved this refresh.
  const cachedEarly = await redis.get(replayKey);
  if (cachedEarly) return JSON.parse(cachedEarly) as AuthTokens;

  const userId = await consumeRefreshToken(refreshTokenId);
  if (!userId) {
    // Lost the GETDEL race — the winner may still be generating tokens.
    // Wait briefly, then retry the replay cache before giving up.
    await new Promise((resolve) => setTimeout(resolve, REFRESH_RACE_WAIT_MS));
    const cachedLate = await redis.get(replayKey);
    if (cachedLate) return JSON.parse(cachedLate) as AuthTokens;
    throw Object.assign(new Error('Invalid or expired refresh token'), { code: 'REFRESH_TOKEN_INVALID' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === 'inactive') {
    throw Object.assign(new Error('Account not found or inactive'), { code: 'ACCOUNT_INACTIVE' });
  }

  const payload: TokenPayload = {
    userId: user.id,
    role: user.role,
    teamId: user.teamId,
    clusterId: user.clusterId,
  };

  const accessToken = generateAccessToken(payload);
  const newRefreshToken = await generateRefreshToken(user.id);
  const tokens: AuthTokens = { accessToken, refreshToken: newRefreshToken };

  // Cache for concurrent sibling requests to replay within the grace window.
  await redis.set(replayKey, JSON.stringify(tokens), 'EX', REFRESH_REPLAY_TTL);

  return tokens;
}

/** Logout — invalidate refresh token */
export async function logout(refreshTokenId: string): Promise<void> {
  await invalidateRefreshToken(refreshTokenId);
}

/** Update current user's own profile fields. Keeps extension + sipExtension in sync. */
export async function updateProfile(userId: string, data: { sipExtension?: string }): Promise<UserProfile> {
  const next = data.sipExtension ?? null;
  const user = await prisma.user.update({
    where: { id: userId },
    data: { sipExtension: next, extension: next },
  });

  const [unreadCount, permissions] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    getPermissionsForRole(user.role, user.clusterId),
  ]);

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    teamId: user.teamId,
    sipExtension: user.extension ?? null,
    callMode: user.callMode,
    mustChangePassword: user.mustChangePassword,
    unreadNotificationCount: unreadCount,
    permissions,
  };
}

/** Get current user profile with unread notification count */
export async function getProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
  }

  const [unreadCount, permissions] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    getPermissionsForRole(user.role, user.clusterId),
  ]);

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    teamId: user.teamId,
    sipExtension: user.extension ?? null,
    callMode: user.callMode,
    mustChangePassword: user.mustChangePassword,
    unreadNotificationCount: unreadCount,
    permissions,
  };
}
