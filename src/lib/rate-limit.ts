import { Ratelimit } from '@upstash/ratelimit';

import { getRedis } from '@/lib/redis';

export type RateLimitBucket = 'translation' | 'image' | 'chatbot' | 'tts' | 'api';

interface BucketConfig {
  perClientMax: number;
  globalMax: number;
  windowSec: number;
}

// Requests per window. globalMax is your absolute spending ceiling per bucket.
const BUCKETS: Record<RateLimitBucket, BucketConfig> = {
  translation: { perClientMax: 40, globalMax: 600, windowSec: 60 },
  image: { perClientMax: 10, globalMax: 120, windowSec: 60 },
  chatbot: { perClientMax: 30, globalMax: 400, windowSec: 60 },
  tts: { perClientMax: 20, globalMax: 300, windowSec: 60 },
  api: { perClientMax: 20, globalMax: 300, windowSec: 60 },
};

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

const ALLOWED: RateLimitResult = { ok: true, retryAfterSeconds: 0 };

/** Best-effort client IP. Spoofable, which is why a global ceiling also exists. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
}

// ----------------------------- Redis (shared) -----------------------------

const limiters = new Map<string, Ratelimit>();

function getLimiter(max: number, windowSec: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const id = `${max}:${windowSec}`;
  let limiter = limiters.get(id);

  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      prefix: 'meaningit:rl',
    });
    limiters.set(id, limiter);
  }

  return limiter;
}

// --------------------- In-memory fallback (per instance) ---------------------

const memoryStore = new Map<string, number[]>();
const MEMORY_MAX_KEYS = 5_000;

function memoryConsume(key: string, max: number, windowSec: number): RateLimitResult {
  const nowMs = Date.now();
  const windowMs = windowSec * 1000;
  const windowStart = nowMs - windowMs;

  if (memoryStore.size > MEMORY_MAX_KEYS) {
    for (const [storedKey, stamps] of memoryStore) {
      if ((stamps[stamps.length - 1] ?? 0) < windowStart) memoryStore.delete(storedKey);
    }
    if (memoryStore.size > MEMORY_MAX_KEYS) memoryStore.clear();
  }

  const recent = (memoryStore.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= max) {
    memoryStore.set(key, recent);
    const oldest = recent[0] ?? nowMs;
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000)),
    };
  }

  recent.push(nowMs);
  memoryStore.set(key, recent);
  return ALLOWED;
}

// --------------------------------- Public API --------------------------------

async function consume(key: string, max: number, windowSec: number): Promise<RateLimitResult> {
  const limiter = getLimiter(max, windowSec);

  if (limiter) {
    try {
      const result = await limiter.limit(key);
      if (result.success) return ALLOWED;

      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      };
    } catch (error: unknown) {
      // Never block real users because the limiter's backend is down.
      console.error('[RateLimit] Redis failed, using in-memory fallback', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  return memoryConsume(key, max, windowSec);
}

export async function checkRateLimit(
  bucket: RateLimitBucket,
  clientKey: string,
): Promise<RateLimitResult> {
  const config = BUCKETS[bucket];

  const perClient = await consume(
    `${bucket}:client:${clientKey}`,
    config.perClientMax,
    config.windowSec,
  );
  if (!perClient.ok) return perClient;

  return consume(`${bucket}:global`, config.globalMax, config.windowSec);
}