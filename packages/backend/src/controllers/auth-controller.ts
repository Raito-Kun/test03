import { Request, Response, NextFunction } from 'express';
import { loginSchema } from '@crm/shared/src/validation/auth-schemas';
import * as authService from '../services/auth-service';

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
