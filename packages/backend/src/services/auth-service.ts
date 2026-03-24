import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import {
  generateAccessToken,
  generateRefreshToken,
  consumeRefreshToken,
  invalidateRefreshToken,
  TokenPayload,
} from '../lib/jwt';
import logger from '../lib/logger';

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
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(user.id);

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });

  logger.info('User logged in', { userId: user.id, role: user.role });

  return {
    tokens: { accessToken, refreshToken },
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      teamId: user.teamId,
      sipExtension: user.sipExtension,
      callMode: user.callMode,
      mustChangePassword: user.mustChangePassword,
      unreadNotificationCount: unreadCount,
    },
  };
}

/** Refresh tokens — atomically consume old refresh token, issue new pair */
export async function refresh(refreshTokenId: string): Promise<AuthTokens> {
  const userId = await consumeRefreshToken(refreshTokenId);
  if (!userId) {
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
  };

  const accessToken = generateAccessToken(payload);
  const newRefreshToken = await generateRefreshToken(user.id);

  return { accessToken, refreshToken: newRefreshToken };
}

/** Logout — invalidate refresh token */
export async function logout(refreshTokenId: string): Promise<void> {
  await invalidateRefreshToken(refreshTokenId);
}

/** Get current user profile with unread notification count */
export async function getProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    teamId: user.teamId,
    sipExtension: user.sipExtension,
    callMode: user.callMode,
    mustChangePassword: user.mustChangePassword,
    unreadNotificationCount: unreadCount,
  };
}
