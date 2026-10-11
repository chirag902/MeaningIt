import { createHash } from 'node:crypto';

import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';

const MEMORY_MAX_ENTRIES = 500;
const memory = new Map<string, { value: unknown; expiresAt: number }>();

export function cacheKey(namespace: string, ...parts: string[]): string {
  const hash = createHash('sha256').update(parts.join('\u0000')).digest('hex');
  return `meaningit:cache:${namespace}:${hash}`;
}

/** Returns a cached value or runs the producer. Failures in the cache never fail the request. */
export async function cachedJson<T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();

  try {
    if (redis) {
      // Wrapped in an object: Upstash auto-parses plain strings that look like JSON.
      const hit = await redis.get<{ v: T }>(key);
      if (hit && typeof hit === 'object' && 'v' in hit) {
        logger.info('cache', { namespace: 'translate', hit: true });
        return hit.v;
      }
    } else {
      const entry = memory.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        logger.info('cache', { namespace: 'translate', hit: true });
        return entry.value as T;
      }
    }
  } catch {
    // Fall through to the producer.
  }

  logger.info('cache', { namespace: 'translate', hit: false });
  const value = await producer();

  try {
    if (redis) {
      await redis.set(key, { v: value }, { ex: ttlSeconds });
    } else {
      if (memory.size >= MEMORY_MAX_ENTRIES) {
        const oldest = memory.keys().next().value;
        if (oldest) memory.delete(oldest);
      }
      memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    }
  } catch {
    // Ignore cache write failures.
  }

  return value;
}