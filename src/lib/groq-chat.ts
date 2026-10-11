import Groq from 'groq-sdk';

export type ChatMessage = Groq.Chat.Completions.ChatCompletionMessageParam;

/**
 * Error thrown by AI flows. Keeps the HTTP status so actions.ts can classify
 * rate limits and timeouts. Messages never contain user content.
 */
export class GroqFlowError extends Error {
  readonly status?: number;
  readonly providerCode?: string;

  constructor(message: string, status?: number, providerCode?: string) {
    super(message);
    this.name = 'GroqFlowError';
    this.status = status;
    this.providerCode = providerCode;
  }
}

// -----------------------------------------------------------------------------
// Client
// -----------------------------------------------------------------------------

let client: Groq | null = null;

export function getGroq(): Groq {
  if (client) return client;

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new GroqFlowError('AI service is not configured.', 500);
  }

  // Retries are handled by createChatCompletion under one shared deadline.
  client = new Groq({ apiKey, maxRetries: 0 });
  return client;
}

// -----------------------------------------------------------------------------
// Sanitizers
// -----------------------------------------------------------------------------

/** Strips control characters (keeps \n and \t) and normalizes Unicode. */
export function cleanUserText(value: string): string {
  return (
    value
      .normalize('NFC')
      
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
  );
}

/**
 * Language names are interpolated into system prompts, so only allow
 * characters that appear in real language names.
 */
export function sanitizeLanguageName(value: string, maxLength = 100): string {
  return value
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N} ()\-_.,'/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

// -----------------------------------------------------------------------------
// Error classification
// -----------------------------------------------------------------------------

function getStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

function getProviderCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const candidate = error as { code?: unknown; error?: { code?: unknown } };
  const code = candidate.code ?? candidate.error?.code;

  return typeof code === 'string' ? code : undefined;
}

function isAbortOrTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    /aborted|timed? ?out/i.test(error.message)
  );
}

function isRetryable(error: unknown): boolean {
  const status = getStatus(error);

  if (status !== undefined) {
    // Groq returns 400 when the model produced invalid JSON. Another try often succeeds.
    if (status === 400) return getProviderCode(error) === 'json_validate_failed';
    return status === 408 || status === 409 || status === 429 || status >= 500;
  }

  return (
    error instanceof Error &&
    /network|econnreset|socket|fetch failed|connection/i.test(error.message)
  );
}

/** Converts any thrown value to a GroqFlowError. Never copies provider messages. */
export function toFlowError(error: unknown): GroqFlowError {
  if (error instanceof GroqFlowError) return error;

  if (isAbortOrTimeout(error)) {
    return new GroqFlowError('The AI request timed out.', 504);
  }

  const status = getStatus(error);
  const code = getProviderCode(error);

  if (status === 429) {
    return new GroqFlowError('The AI service is busy (rate limited).', 429, code);
  }

  if (status === 401 || status === 403 || status === 404) {
    return new GroqFlowError(`AI service configuration error (status ${status}).`, status, code);
  }

  return new GroqFlowError(
    `AI request failed${status ? ` (status ${status})` : ''}.`,
    status,
    code,
  );
}

// -----------------------------------------------------------------------------
// Completion with one shared deadline
// -----------------------------------------------------------------------------

export interface CompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  /** Total time budget for all attempts, in milliseconds. */
  deadlineMs: number;
  json?: boolean;
  maxAttempts?: number;
}

const MIN_ATTEMPT_MS = 1_500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createChatCompletion(options: CompletionOptions) {
  const groq = getGroq();
  const maxAttempts = options.maxAttempts ?? 2;
  const startedAt = Date.now();

  // gpt-oss models spend hidden tokens reasoning. Translation and tutoring
  // don't need much, and it cuts both latency and truncation.
  const reasoning = /gpt-oss/i.test(options.model)
    ? { reasoning_effort: 'low' as const }
    : {};

  for (let attempt = 1; ; attempt += 1) {
    const remaining = options.deadlineMs - (Date.now() - startedAt);

    if (remaining < MIN_ATTEMPT_MS) {
      throw new GroqFlowError('The AI request timed out.', 504);
    }

    try {
      return await groq.chat.completions.create(
        {
          model: options.model,
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          ...(options.json ? { response_format: { type: 'json_object' as const } } : {}),
          ...reasoning,
        },
        { signal: AbortSignal.timeout(remaining) },
      );
    } catch (error: unknown) {
      if (attempt >= maxAttempts || isAbortOrTimeout(error) || !isRetryable(error)) {
        throw toFlowError(error);
      }

      await wait(Math.min(400 * 2 ** (attempt - 1), 1_500));
    }
  }
}