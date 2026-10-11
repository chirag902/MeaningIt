import { describe, expect, it } from 'vitest';

import { checkRateLimit } from '@/lib/rate-limit';

describe('rate limiter (in-memory fallback)', () => {
  it('blocks a client after the limit and reports a retry time', async () => {
    const client = `test-${Math.random()}`;

    for (let i = 0; i < 10; i += 1) {
      expect((await checkRateLimit('image', client)).ok).toBe(true);
    }

    const blocked = await checkRateLimit('image', client);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keeps clients independent', async () => {
    const a = `test-a-${Math.random()}`;
    const b = `test-b-${Math.random()}`;

    for (let i = 0; i < 10; i += 1) await checkRateLimit('image', a);

    expect((await checkRateLimit('image', a)).ok).toBe(false);
    expect((await checkRateLimit('image', b)).ok).toBe(true);
  });
});