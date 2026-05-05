import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../lib/redis';

const isTest = process.env.NODE_ENV === 'test' || process.env.REDIS_ENABLED === 'false';

function createRedisStore(prefix: string) {
  if (isTest) return undefined; // Use in-memory store for tests
  return new RedisStore({
    sendCommand: ((...args: string[]) => redis.call(args[0], ...args.slice(1))) as never,
    prefix,
  });
}

/** Global API rate limit: 60 req/min per user */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 1000 : parseInt(process.env.GLOBAL_RATE_LIMIT || '120', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests' },
  },
  store: createRedisStore('rl:global:'),
});

/**
 * Login rate limit — configurable via LOGIN_RATE_LIMIT env (default 30/min).
 *
 * Keyed by normalized email when present so offices behind NAT don't share
 * one bucket (the previous per-IP default of 10 throttled entire teams).
 * Falls back to IP for unparseable bodies. Malicious brute-force is still
 * limited per-email, and the global limiter + express body size caps keep
 * the endpoint bounded overall.
 */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 1000 : parseInt(process.env.LOGIN_RATE_LIMIT || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = (req.body as { email?: string } | undefined)?.email;
    if (email && typeof email === 'string') return `email:${email.trim().toLowerCase()}`;
    return `ip:${req.ip || 'unknown'}`;
  },
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many login attempts' },
  },
  store: createRedisStore('rl:login:'),
});

/** Click-to-Call rate limit: 10 req/min per user */
export const callLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as never as { user?: { userId: string } }).user?.userId || req.ip || 'unknown',
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many call requests' },
  },
  store: createRedisStore('rl:call:'),
});
