import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { loginSchema } from '@crm/shared/src/validation/auth-schemas';
import * as authService from '../services/auth-service';
import prisma from '../lib/prisma';

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_NAME = 'crm_refresh_token';

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/auth',
  });
}

/** POST /auth/login */
export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const { tokens, user } = await authService.login(email, password);

    setRefreshCookie(res, tokens.refreshToken);

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        user,
      },
    });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'INVALID_CREDENTIALS' || error.code === 'ACCOUNT_INACTIVE') {
      const status = error.code === 'ACCOUNT_INACTIVE' ? 403 : 401;
      res.status(status).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    next(err);
  }
}

/** POST /auth/refresh */
export async function refreshHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshTokenId = req.cookies?.[COOKIE_NAME];
    if (!refreshTokenId) {
      res.status(401).json({
        success: false,
        error: { code: 'REFRESH_TOKEN_INVALID', message: 'No refresh token provided' },
      });
      return;
    }

    const tokens = await authService.refresh(refreshTokenId);
    setRefreshCookie(res, tokens.refreshToken);

    res.json({
      success: true,
      data: { accessToken: tokens.accessToken },
    });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'REFRESH_TOKEN_INVALID' || error.code === 'ACCOUNT_INACTIVE') {
      res.status(401).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    next(err);
  }
}

/** POST /auth/logout */
export async function logoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshTokenId = req.cookies?.[COOKIE_NAME];
    if (refreshTokenId) {
      await authService.logout(refreshTokenId);
    }

    res.clearCookie(COOKIE_NAME, { path: '/api/v1/auth' });
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}

/** GET /auth/me */
export async function meHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getProfile(req.user!.userId);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

/** PATCH /auth/me — handles password change or sipExtension update */
export async function updateMeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword, sipExtension } = req.body;

    // Password change flow
    if (currentPassword !== undefined || newPassword !== undefined) {
      if (!currentPassword || !newPassword) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'currentPassword and newPassword required' } });
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        return;
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });
        return;
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
      res.json({ success: true, data: null });
      return;
    }

    // SIP extension update flow
    if (sipExtension !== undefined) {
      const updated = await authService.updateProfile(userId, { sipExtension: sipExtension || undefined });
      res.json({ success: true, data: updated });
      return;
    }

    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'No valid fields to update' } });
  } catch (err) {
    next(err);
  }
}
