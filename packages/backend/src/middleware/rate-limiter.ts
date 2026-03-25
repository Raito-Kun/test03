import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../lib/redis';

const isTest = process.env.NODE_ENV === 'test';

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
  max: isTest ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests' },
  },
  store: createRedisStore('rl:global:'),
});

/** Login rate limit: 10 req/min per IP */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
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
