import Redis from 'ioredis';
import logger from './logger';

const isTest = process.env.NODE_ENV === 'test';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: isTest ? 1 : 3,
  retryStrategy(times) {
    if (isTest && times > 1) return null; // Stop retrying in test mode
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
  lazyConnect: isTest,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => {
  if (!isTest) logger.error('Redis error', { error: err.message });
});

export default redis;
