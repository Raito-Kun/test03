import Redis from 'ioredis';
import logger from './logger';

const skipRedis = process.env.NODE_ENV === 'test' || process.env.REDIS_ENABLED === 'false';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: skipRedis ? 1 : 3,
  retryStrategy(times) {
    if (skipRedis && times > 1) return null;
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
  lazyConnect: skipRedis,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => {
  if (!skipRedis) logger.error('Redis error', { error: err.message });
});

export default redis;
