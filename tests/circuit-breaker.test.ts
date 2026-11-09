import { describe, expect, it, vi } from 'vitest';

import { CircuitOpenError, createBreaker } from '@/lib/circuit-breaker';

const outage = () => true;

describe('circuit breaker', () => {
  it('opens after the threshold and then fails fast', async () => {
    const run = createBreaker({ failureThreshold: 2, cooldownMs: 1_000 });
    const failing = vi.fn().mockRejectedValue(new Error('down'));

    await expect(run(failing, outage)).rejects.toThrow('down');
    await expect(run(failing, outage)).rejects.toThrow('down');
    await expect(run(failing, outage)).rejects.toBeInstanceOf(CircuitOpenError);

    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('ignores errors that are not outages', async () => {
    const run = createBreaker({ failureThreshold: 1, cooldownMs: 1_000 });

    await expect(run(() => Promise.reject(new Error('bad input')), () => false)).rejects.toThrow();
    await expect(run(() => Promise.resolve('ok'), () => false)).resolves.toBe('ok');
  });

  it('recovers after the cooldown', async () => {
    vi.useFakeTimers();
    const run = createBreaker({ failureThreshold: 1, cooldownMs: 1_000 });

    await expect(run(() => Promise.reject(new Error('down')), outage)).rejects.toThrow();
    await expect(run(() => Promise.resolve('ok'), outage)).rejects.toBeInstanceOf(CircuitOpenError);

    vi.advanceTimersByTime(1_001);
    await expect(run(() => Promise.resolve('ok'), outage)).resolves.toBe('ok');

    vi.useRealTimers();
  });
});