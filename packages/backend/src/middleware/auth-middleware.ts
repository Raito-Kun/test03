import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../lib/jwt';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      dataScope?: Record<string, unknown>;
    }
  }
}

/**
 * JWT authentication middleware.
 * Extracts Bearer token from Authorization header, verifies, attaches req.user.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  // Support query string token for browser media elements (<audio>, <a download>)
  const queryToken = req.query.token as string | undefined;

  if (!authHeader?.startsWith('Bearer ') && !queryToken) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken!;
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
    res.status(401).json({
      success: false,
      error: {
        code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
        message: isExpired ? 'Token has expired' : 'Invalid token',
      },
    });
  }
}
