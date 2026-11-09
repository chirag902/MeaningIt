export class CircuitOpenError extends Error {
    readonly status = 503;
  
    constructor() {
      super('Service temporarily unavailable.');
      this.name = 'CircuitOpenError';
    }
  }
  
  interface BreakerOptions {
    failureThreshold: number;
    cooldownMs: number;
  }
  
  export function createBreaker({ failureThreshold, cooldownMs }: BreakerOptions) {
    let failures = 0;
    let openedAt = 0;
    let probing = false;
  
    return async function run<T>(
      task: () => Promise<T>,
      countsAsFailure: (error: unknown) => boolean,
    ): Promise<T> {
      if (failures >= failureThreshold) {
        const cooledDown = Date.now() - openedAt >= cooldownMs;
  
        // Open: fail fast. After the cooldown, let exactly one probe through.
        if (!cooledDown || probing) throw new CircuitOpenError();
        probing = true;
      }
  
      try {
        const result = await task();
        failures = 0;
        probing = false;
        return result;
      } catch (error: unknown) {
        probing = false;
  
        if (countsAsFailure(error)) {
          failures += 1;
          if (failures >= failureThreshold) openedAt = Date.now();
        }
  
        throw error;
      }
    };
  }
  
  /** Provider outages count. Bad input, auth problems, and rate limits do not. */
  export function isProviderOutage(error: unknown): boolean {
    if (error instanceof CircuitOpenError) return false;
  
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? (error as { status?: unknown }).status
        : undefined;
  
    if (typeof status === 'number') return status === 408 || status >= 500;
  
    // No status: network failure or timeout.
    return error instanceof Error;
  }
  
  export const groqBreaker = createBreaker({ failureThreshold: 5, cooldownMs: 30_000 });