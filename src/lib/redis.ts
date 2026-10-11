import { Redis } from '@upstash/redis';

let client: Redis | null | undefined;

/** Returns a shared Redis client, or null when Upstash isn't configured. */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  client = url && token ? new Redis({ url, token }) : null;
  return client;
}