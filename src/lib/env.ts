import { z } from 'zod';

const schema = z.object({
  GROQ_API_KEY: z.string().min(10, 'missing'),
  GROQ_VISION_MODEL: z.string().min(1).default('qwen/qwen3.8-27b'),
  GROQ_VISION_FALLBACK_MODELS: z.string().optional(),
  GROQ_TRANSLATE_MODEL: z.string().min(1).default('openai/gpt-oss-20b'),
  ALLOWED_ORIGINS: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  HEALTHCHECK_SECRET: z.string().min(16).optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid server configuration. Check: ${fields}`);
  }

  cached = parsed.data;
  return cached;
}