
'use server';

import { z } from 'zod';

const DEFAULT_LANGUAGE_CODE = 'en-US';
const DEFAULT_VOICE_GENDER = 'FEMALE';
const DEFAULT_AUDIO_MIME = 'audio/wav';

const TTS_TIMEOUT_MS = 20_000;
const MAX_TEXT_LENGTH = 5_000;
const MAX_LANGUAGE_CODE_LENGTH = 35;
const MAX_VOICE_NAME_LENGTH = 150;
const MAX_AUDIO_BASE64_LENGTH = 15_000_000;
const MAX_PROVIDER_RESPONSE_BYTES = MAX_AUDIO_BASE64_LENGTH + 100_000;

const TextToSpeechInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Text cannot be empty.')
    .max(MAX_TEXT_LENGTH, 'Text is too long for speech synthesis.'),

  languageCode: z
    .string()
    .trim()
    .min(2)
    .max(MAX_LANGUAGE_CODE_LENGTH)
    .optional(),

  voiceGender: z.enum(['MALE', 'FEMALE']).optional(),

  voiceName: z
    .string()
    .trim()
    .min(1)
    .max(MAX_VOICE_NAME_LENGTH)
    .optional(),
});

export type TextToSpeechInput = z.infer<typeof TextToSpeechInputSchema>;

const TextToSpeechOutputSchema = z.object({
  audioDataUri: z.string().nullable(),
  ssml: z.string().optional(),
});

export type TextToSpeechOutput = z.infer<typeof TextToSpeechOutputSchema>;

const TTSProviderResponseSchema = z
  .object({
    audioDataUri: z.string().optional(),
    audioBase64: z.string().optional(),
    mime: z.string().optional(),
  })
  .passthrough();

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildSsml(text: string): string {
  return `<speak>${escapeXml(text)}</speak>`;
}

function getTtsApiUrl(): string | null {
  const rawUrl = process.env.TTS_API_URL?.trim();

  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      console.error('[MeaningIt TTS] Unsupported provider URL protocol.');
      return null;
    }

    if (url.username || url.password) {
      console.error('[MeaningIt TTS] Credentials must not be embedded in the provider URL.');
      return null;
    }

    return url.toString();
  } catch {
    console.error('[MeaningIt TTS] Invalid TTS_API_URL configuration.');
    return null;
  }
}

function isValidBase64(value: string): boolean {
  if (
    !value ||
    value.length > MAX_AUDIO_BASE64_LENGTH ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    return false;
  }

  return true;
}

function isValidAudioMime(mime: string): boolean {
  return /^audio\/[a-z0-9][a-z0-9.+-]*$/i.test(mime);
}

function buildAudioDataUri(
  audioBase64: string,
  mime: string,
): string | null {
  const normalizedBase64 = audioBase64.replace(/\s+/g, '');
  const normalizedMime = mime.trim().toLowerCase();

  if (!isValidAudioMime(normalizedMime)) {
    console.error('[MeaningIt TTS] Invalid audio MIME type.');
    return null;
  }

  if (!isValidBase64(normalizedBase64)) {
    console.error('[MeaningIt TTS] Invalid or oversized Base64 audio.');
    return null;
  }

  return `data:${normalizedMime};base64,${normalizedBase64}`;
}

function validateAudioDataUri(value: string): string | null {
  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > MAX_AUDIO_BASE64_LENGTH + 100
  ) {
    return null;
  }

  const match = normalized.match(
    /^data:(audio\/[a-z0-9][a-z0-9.+-]*);base64,([A-Za-z0-9+/]*={0,2})$/i,
  );

  if (!match) {
    return null;
  }

  const mime = match[1];
  const payload = match[2];

  if (!isValidAudioMime(mime) || !isValidBase64(payload)) {
    return null;
  }

  return `data:${mime.toLowerCase()};base64,${payload}`;
}

function createTimeoutController(timeoutMs: number): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timeoutId),
  };
}

/**
 * Reads a provider response with a strict byte limit.
 * This protects against unexpectedly large or chunked responses.
 */
async function readResponseText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLength = response.headers.get('content-length');

  if (contentLength !== null) {
    const declaredLength = Number(contentLength);

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > maxBytes
    ) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('TTS provider response exceeded the size limit.');
    }
  }

  if (!response.body) {
    throw new Error('TTS provider returned an empty response body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let result = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('TTS provider response exceeded the size limit.');
      }

      result += decoder.decode(value, { stream: true });
    }

    result += decoder.decode();
    return result;
  } finally {
    reader.releaseLock();
  }
}

function fallbackResult(ssml: string): TextToSpeechOutput {
  return {
    audioDataUri: null,
    ssml,
  };
}

export async function textToSpeech(
  input: TextToSpeechInput,
): Promise<TextToSpeechOutput> {
  const validated = TextToSpeechInputSchema.parse(input);

  const languageCode =
    validated.languageCode || DEFAULT_LANGUAGE_CODE;

  const voiceGender =
    validated.voiceGender || DEFAULT_VOICE_GENDER;

  const voiceName = validated.voiceName || undefined;

  const ssml = buildSsml(validated.text);
  const ttsApiUrl = getTtsApiUrl();

  // Server-side TTS is optional. The client can use browser speech.
  if (!ttsApiUrl) {
    return fallbackResult(ssml);
  }

  const ttsApiKey = process.env.TTS_API_KEY?.trim();

  const timeout = createTimeoutController(TTS_TIMEOUT_MS);

  try {
    const response = await fetch(ttsApiUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(ttsApiKey
          ? { Authorization: `Bearer ${ttsApiKey}` }
          : {}),
      },
      body: JSON.stringify({
        text: validated.text,
        ssml,
        languageCode,
        voiceGender,
        ...(voiceName ? { voiceName } : {}),
        format: 'wav',
      }),
      signal: timeout.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[MeaningIt TTS] Provider request failed.', {
        status: response.status,
      });

      await response.body?.cancel().catch(() => undefined);
      return fallbackResult(ssml);
    }

    const contentType =
      response.headers.get('content-type')?.toLowerCase() || '';

    if (!contentType.includes('application/json')) {
      console.error('[MeaningIt TTS] Provider returned a non-JSON response.');

      await response.body?.cancel().catch(() => undefined);
      return fallbackResult(ssml);
    }

    const responseText = await readResponseText(
      response,
      MAX_PROVIDER_RESPONSE_BYTES,
    );

    let rawJson: unknown;

    try {
      rawJson = JSON.parse(responseText);
    } catch {
      console.error('[MeaningIt TTS] Provider returned invalid JSON.');
      return fallbackResult(ssml);
    }

    const parsed = TTSProviderResponseSchema.safeParse(rawJson);

    if (!parsed.success) {
      console.error('[MeaningIt TTS] Invalid provider response structure.');
      return fallbackResult(ssml);
    }

    const providerData = parsed.data;

    // Format 1: provider returns a complete audio data URI.
    if (providerData.audioDataUri) {
      const audioDataUri = validateAudioDataUri(
        providerData.audioDataUri,
      );

      if (audioDataUri) {
        return { audioDataUri, ssml };
      }

      console.error('[MeaningIt TTS] Invalid audio data URI.');
    }

    // Format 2: provider returns Base64 plus a MIME type.
    if (providerData.audioBase64) {
      const audioDataUri = buildAudioDataUri(
        providerData.audioBase64,
        providerData.mime || DEFAULT_AUDIO_MIME,
      );

      if (audioDataUri) {
        return { audioDataUri, ssml };
      }
    }

    console.error('[MeaningIt TTS] Provider returned no usable audio.');
    return fallbackResult(ssml);
  } catch (error: unknown) {
    if (timeout.signal.aborted) {
      console.error(
        `[MeaningIt TTS] Provider timed out after ${TTS_TIMEOUT_MS}ms.`,
      );
    } else {
      console.error(
        '[MeaningIt TTS] Provider request failed.',
        error instanceof Error ? error.message : 'Unknown provider error',
      );
    }

    return fallbackResult(ssml);
  } finally {
    timeout.dispose();
  }
}
