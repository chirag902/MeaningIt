'use server';

import { z } from 'zod';

import { logger } from '@/lib/logger';

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const DEFAULT_LANGUAGE_CODE = 'en-US';
const DEFAULT_VOICE_GENDER = 'FEMALE';
const DEFAULT_AUDIO_MIME = 'audio/wav';

const TTS_TIMEOUT_MS = 20_000;

// Matches actions.ts (10,000). Longer text is still accepted, but only the
// browser's own speech engine reads it.
const MAX_TEXT_LENGTH = 10_000;
// Above this, skip the paid provider: audio payloads grow fast, and every
// byte travels through a server action to the browser.
const MAX_SERVER_TTS_CHARS = 1_500;

const MAX_LANGUAGE_CODE_LENGTH = 35;
const MAX_VOICE_NAME_LENGTH = 150;
const MAX_AUDIO_BASE64_LENGTH = 10_000_000; // about 7 MB of audio
const MAX_PROVIDER_RESPONSE_BYTES = MAX_AUDIO_BASE64_LENGTH + 100_000;

/* -------------------------------------------------------------------------- */
/* Schemas                                                                    */
/* -------------------------------------------------------------------------- */

const TextToSpeechInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Text cannot be empty.')
    .max(MAX_TEXT_LENGTH, 'Text is too long for speech synthesis.'),

  // BCP-47 style, e.g. "en", "hi-IN", "zh-Hans-CN"
  languageCode: z
    .string()
    .trim()
    .max(MAX_LANGUAGE_CODE_LENGTH)
    .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/, 'Invalid language code.')
    .optional(),

  voiceGender: z.enum(['MALE', 'FEMALE']).optional(),

  voiceName: z
    .string()
    .trim()
    .min(1)
    .max(MAX_VOICE_NAME_LENGTH)
    .regex(/^[A-Za-z0-9._-]+$/, 'Invalid voice name.')
    .optional(),
});

export type TextToSpeechInput = z.infer<typeof TextToSpeechInputSchema>;

export type TextToSpeechOutput = {
  audioDataUri: string | null;
  ssml?: string;
};

const TTSProviderResponseSchema = z
  .object({
    audioDataUri: z.string().optional(),
    audioBase64: z.string().optional(),
    mime: z.string().optional(),
  })
  .passthrough();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function escapeXml(text: string): string {
  return (
    text
      // Control characters are invalid in XML 1.0.
      
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  );
}

function buildSsml(text: string): string {
  return `<speak>${escapeXml(text)}</speak>`;
}

function fallbackResult(ssml: string): TextToSpeechOutput {
  return { audioDataUri: null, ssml };
}

function getTtsApiUrl(): string | null {
  const rawUrl = process.env.TTS_API_URL?.trim();
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    const isProduction = process.env.NODE_ENV === 'production';
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && (!isProduction || isLocal))) {
      logger.error('TTS provider URL must use https in production.');
      return null;
    }

    if (url.username || url.password) {
      logger.error('TTS provider URL must not contain embedded credentials.');
      return null;
    }

    return url.toString();
  } catch {
    logger.error('TTS_API_URL is not a valid URL.');
    return null;
  }
}

/** Linear scan, no backtracking. Safe on multi-MB strings. */
function isValidBase64(value: string): boolean {
  if (!value || value.length > MAX_AUDIO_BASE64_LENGTH || value.length % 4 !== 0) {
    return false;
  }

  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return !/[^A-Za-z0-9+/]/.test(value.slice(0, value.length - padding));
}

function isValidAudioMime(mime: string): boolean {
  return /^audio\/[a-z0-9][a-z0-9.+-]*$/i.test(mime);
}

function buildAudioDataUri(audioBase64: string, mime: string): string | null {
  const payload = /\s/.test(audioBase64) ? audioBase64.replace(/\s+/g, '') : audioBase64;
  const normalizedMime = mime.trim().toLowerCase();

  if (!isValidAudioMime(normalizedMime)) {
    logger.error('TTS provider returned an invalid audio MIME type.');
    return null;
  }

  if (!isValidBase64(payload)) {
    logger.error('TTS provider returned invalid or oversized Base64 audio.');
    return null;
  }

  return `data:${normalizedMime};base64,${payload}`;
}

/** Parses a data URI by position instead of running a regex over megabytes. */
function validateAudioDataUri(value: string): string | null {
  const normalized = value.trim();
  const marker = ';base64,';

  if (!normalized.startsWith('data:') || normalized.length > MAX_AUDIO_BASE64_LENGTH + 100) {
    return null;
  }

  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0 || markerIndex > 100) return null;

  const mime = normalized.slice(5, markerIndex).toLowerCase();
  const payload = normalized.slice(markerIndex + marker.length);

  if (!isValidAudioMime(mime) || !isValidBase64(payload)) return null;

  return `data:${mime};base64,${payload}`;
}

/** Reads a response body with a strict byte limit. */
async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'));

  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('TTS provider response exceeded the size limit.');
  }

  if (!response.body) {
    throw new Error('TTS provider returned an empty response body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('TTS provider response exceeded the size limit.');
      }

      parts.push(decoder.decode(value, { stream: true }));
    }

    parts.push(decoder.decode());
    return parts.join('');
  } finally {
    reader.releaseLock();
  }
}

/* -------------------------------------------------------------------------- */
/* Main function                                                              */
/* -------------------------------------------------------------------------- */

export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
  const parsed = TextToSpeechInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid text-to-speech request.');
  }

  const { text } = parsed.data;
  const languageCode = parsed.data.languageCode || DEFAULT_LANGUAGE_CODE;
  const voiceGender = parsed.data.voiceGender || DEFAULT_VOICE_GENDER;
  const voiceName = parsed.data.voiceName || undefined;

  const ssml = buildSsml(text);

  // Server-side TTS is optional. Without a provider, or for long text, the
  // client reads the SSML or text with the browser's speech engine.
  const ttsApiUrl = getTtsApiUrl();
  if (!ttsApiUrl || text.length > MAX_SERVER_TTS_CHARS) {
    return fallbackResult(ssml);
  }

  const ttsApiKey = process.env.TTS_API_KEY?.trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  try {
    const response = await fetch(ttsApiUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(ttsApiKey ? { Authorization: `Bearer ${ttsApiKey}` } : {}),
      },
      body: JSON.stringify({
        text,
        ssml,
        languageCode,
        voiceGender,
        ...(voiceName ? { voiceName } : {}),
        format: 'wav',
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      logger.error('TTS provider request failed.', { status: response.status });
      await response.body?.cancel().catch(() => undefined);
      return fallbackResult(ssml);
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() || '';

    if (!contentType.includes('application/json')) {
      logger.error('TTS provider returned a non-JSON response.', { contentType });
      await response.body?.cancel().catch(() => undefined);
      return fallbackResult(ssml);
    }

    const responseText = await readResponseText(response, MAX_PROVIDER_RESPONSE_BYTES);

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(responseText);
    } catch {
      logger.error('TTS provider returned invalid JSON.');
      return fallbackResult(ssml);
    }

    const providerResponse = TTSProviderResponseSchema.safeParse(rawJson);

    if (!providerResponse.success) {
      logger.error('TTS provider response has an unexpected structure.');
      return fallbackResult(ssml);
    }

    const data = providerResponse.data;

    // Format 1: a complete audio data URI.
    if (data.audioDataUri) {
      const audioDataUri = validateAudioDataUri(data.audioDataUri);
      if (audioDataUri) return { audioDataUri, ssml };

      logger.error('TTS provider returned an invalid audio data URI.');
    }

    // Format 2: Base64 audio plus a MIME type.
    if (data.audioBase64) {
      const audioDataUri = buildAudioDataUri(data.audioBase64, data.mime || DEFAULT_AUDIO_MIME);
      if (audioDataUri) return { audioDataUri, ssml };
    }

    logger.error('TTS provider returned no usable audio.');
    return fallbackResult(ssml);
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      logger.error('TTS provider timed out.', { timeoutMs: TTS_TIMEOUT_MS });
    } else {
      logger.error('TTS provider request failed.', {
        reason: error instanceof Error ? error.message : 'Unknown provider error',
      });
    }

    return fallbackResult(ssml);
  } finally {
    clearTimeout(timeoutId);
  }
}