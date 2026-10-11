'use server';

import { headers } from 'next/headers';
import { z } from 'zod';

import {
  translateWithSlang,
  type TranslateWithSlangOutput,
} from '@/ai/flows/translate-with-slang';
import { translateImage } from '@/ai/flows/translate-image-flow';
import { getChatbotResponse } from '@/ai/flows/chatbot-flow';
import { textToSpeech } from '@/ai/flows/text-to-speech';
import { checkRateLimit, getClientIp, type RateLimitBucket } from '@/lib/rate-limit';

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const MAX_TRANSLATION_TEXT_LENGTH = 10_000;
const MAX_IMAGE_DATA_URI_LENGTH = 12 * 1024 * 1024; // matches translate-image-flow
const MAX_CHATBOT_INPUT_LENGTH = 2_000;
const MAX_CHATBOT_HISTORY_MESSAGES = 20;
const MAX_CHATBOT_HISTORY_MESSAGE_LENGTH = 1_500;
const MAX_LANGUAGE_LENGTH = 50;
const MAX_VOICE_NAME_LENGTH = 150;

const TIMEOUT_MS = {
  translation: 30_000,
  image: 45_000,
  chatbot: 30_000,
  tts: 30_000,
} as const;



// Sentinel returned by translate-image-flow when server OCR can't read the image.
const CLIENT_OCR_SENTINEL = '__CLIENT_OCR_REQUIRED__';

/* -------------------------------------------------------------------------- */
/* Shared types                                                               */
/* -------------------------------------------------------------------------- */

type ActionErrorCode =
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'SERVICE_BUSY'
  | 'IMAGE_UNREADABLE'
  | 'INTERNAL';

type ActionFailure = {
  success: false;
  error: string;
  code?: ActionErrorCode;
  requestId?: string;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

class ActionTimeoutError extends Error {
  constructor() {
    super('Operation timed out.');
    this.name = 'ActionTimeoutError';
  }
}

function newRequestId(): string {
  return crypto.randomUUID();
}

/** Removes control characters (keeps \n and \t) and normalizes Unicode. */
function cleanText(value: string): string {
  return value
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function cleanLine(value: string): string {
  return cleanText(value).replace(/\s+/g, ' ');
}

function boundedText(max: number, options: { min?: number; tooLong: string; empty?: string }) {
  return z
    .string()
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(options.min ?? 0, options.empty ?? 'This field cannot be empty.')
        .max(max, options.tooLong),
    );
}

function languageField(requiredMessage: string) {
  return z
    .string()
    .transform(cleanLine)
    .pipe(
      z
        .string()
        .min(1, requiredMessage)
        .max(MAX_LANGUAGE_LENGTH, 'Language value is too long.'),
    );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ActionTimeoutError()), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function getStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

function logServerActionError(action: string, requestId: string, error: unknown): void {
  if (error instanceof Error) {
    // Never log user input (text, images, chat history).
    console.error(`[${action}]`, {
      requestId,
      name: error.name,
      message: error.message,
      status: getStatus(error),
      stack: error.stack,
    });
    return;
  }

  console.error(`[${action}]`, { requestId, error: String(error) });
}

/**
 * Converts any thrown error into a message that is safe to show users.
 * Raw provider messages are never forwarded to the browser.
 */
function toFailure(
  action: string,
  requestId: string,
  error: unknown,
  fallback: string,
): ActionFailure {
  logServerActionError(action, requestId, error);

  const status = getStatus(error);
  const message = error instanceof Error ? error.message : '';

  if (error instanceof ActionTimeoutError || /timed? ?out|aborted/i.test(message)) {
    return {
      success: false,
      error: 'This is taking too long. Please try again.',
      code: 'TIMEOUT',
      requestId,
    };
  }

  if (status === 429 || /rate.?limit|too many requests/i.test(message)) {
    return {
      success: false,
      error: 'The service is busy right now. Please try again in a moment.',
      code: 'SERVICE_BUSY',
      requestId,
    };
  }

  return { success: false, error: fallback, code: 'INTERNAL', requestId };
}

function invalidInput(requestId: string, error: z.ZodError, fallback: string): ActionFailure {
  // Schema messages are authored here, so they are safe to show.
  return {
    success: false,
    error: error.issues[0]?.message ?? fallback,
    code: 'INVALID_INPUT',
    requestId,
  };
}

/* -------------------------------------------------------------------------- */
/* Rate limiting (sliding window, in-memory)                                  */
/* -------------------------------------------------------------------------- */



/** Returns a failure when the caller is over the limit, otherwise null. */
async function enforceRateLimit(
  action: RateLimitBucket,
  requestId: string,
): Promise<ActionFailure | null> {
  const result = await checkRateLimit(action, getClientIp(await headers()));
  if (result.ok) return null;

  return {
    success: false,
    error: 'Too many requests. Please wait a moment and try again.',
    code: 'RATE_LIMITED',
    requestId,
  };
}

 

/* -------------------------------------------------------------------------- */
/* Translation                                                                */
/* -------------------------------------------------------------------------- */

export type TranslateWithSlangInput = {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  isSpeedBoosted?: boolean;
};

const TranslateSchema = z.object({
  text: boundedText(MAX_TRANSLATION_TEXT_LENGTH, {
    tooLong: `Text must not exceed ${MAX_TRANSLATION_TEXT_LENGTH} characters.`,
  }),
  sourceLanguage: languageField('Source language is required.'),
  targetLanguage: languageField('Target language is required.'),
  isSpeedBoosted: z.boolean().optional(),
});

export type HandleTranslationResult =
  | {
      success: true;
      translation: string;
      detectedLanguageName?: string;
      detectedLanguageCode?: string;
      toneAnalysis?: string;
      suggestions: string[];
    }
  | ActionFailure;

export async function handleTranslation(
  data: TranslateWithSlangInput,
): Promise<HandleTranslationResult> {
  const requestId = newRequestId();

  const validation = TranslateSchema.safeParse(data);
  if (!validation.success) {
    return invalidInput(requestId, validation.error, 'Invalid translation input.');
  }

  const validated = validation.data;

  // Cheap no-op cases come before the rate limiter and the provider call.
  if (validated.text.length === 0) {
    return { success: true, translation: '', suggestions: [] };
  }

  if (validated.sourceLanguage.toLowerCase() === validated.targetLanguage.toLowerCase()) {
    return {
      success: true,
      translation: validated.text,
      detectedLanguageName: validated.sourceLanguage,
      detectedLanguageCode: validated.sourceLanguage,
      suggestions: [],
    };
  }

  const limited = await enforceRateLimit('translation', requestId);
  if (limited) return limited;

  try {
    const out: TranslateWithSlangOutput = await withTimeout(
      translateWithSlang({
        ...validated,
        isSpeedBoosted: validated.isSpeedBoosted ?? false,
      }),
      TIMEOUT_MS.translation,
    );

    return {
      success: true,
      translation: out.translation,
      detectedLanguageName: out.detectedLanguageName,
      detectedLanguageCode: out.detectedLanguageCode,
      toneAnalysis: out.toneAnalysis,
      suggestions: out.suggestions ?? [],
    };
  } catch (error: unknown) {
    return toFailure('handleTranslation', requestId, error, 'Translation failed. Please try again.');
  }
}

/* -------------------------------------------------------------------------- */
/* Image Translation                                                          */
/* -------------------------------------------------------------------------- */

const TranslateImageSchema = z.object({
  photoDataUri: z
    .string()
    .min(1, 'Image data is required.')
    .max(MAX_IMAGE_DATA_URI_LENGTH, 'Image is too large. Please use an image under 12 MB.')
    // Prefix-only check: a regex over a multi-MB base64 string can block the event loop.
    .regex(
      /^data:image\/(?:jpeg|jpg|png|webp|bmp|gif);base64,/i,
      'Unsupported image format. Please use JPG, PNG, WebP, BMP, or GIF.',
    ),
  targetLanguage: languageField('Target language is required.'),
});

export type TranslateImageInput = z.infer<typeof TranslateImageSchema>;

export type HandleImageTranslationResult =
  | { success: true; translation: string }
  | ActionFailure;

export async function handleImageTranslation(
  data: TranslateImageInput,
): Promise<HandleImageTranslationResult> {
  const requestId = newRequestId();

  const validation = TranslateImageSchema.safeParse(data);
  if (!validation.success) {
    return invalidInput(requestId, validation.error, 'Invalid image translation input.');
  }

  const limited = await enforceRateLimit('image', requestId);
  if (limited) return limited;

  try {
    const out = await withTimeout(translateImage(validation.data), TIMEOUT_MS.image);

    // The flow signals "server OCR failed" with a sentinel string. Never show it as a translation.
    if (out.translation === CLIENT_OCR_SENTINEL) {
      return {
        success: false,
        error:
          'Could not read text from this image. Try a sharper, closer photo with good lighting.',
        code: 'IMAGE_UNREADABLE',
        requestId,
      };
    }

    return { success: true, translation: out.translation };
  } catch (error: unknown) {
    return toFailure(
      'handleImageTranslation',
      requestId,
      error,
      'Image translation failed. Please try again.',
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Chatbot                                                                    */
/* -------------------------------------------------------------------------- */

const ChatbotActionInputSchema = z.object({
  userInput: boundedText(MAX_CHATBOT_INPUT_LENGTH, {
    min: 1,
    empty: 'Message cannot be empty.',
    tooLong: 'Message is too long.',
  }),
  targetLanguage: languageField('Target language is required.'),
  history: z
    .array(
      z.object({
        // 'system' is deliberately not accepted from the client: it would let
        // callers inject system-level instructions.
        role: z.enum(['user', 'assistant']),
        content: boundedText(MAX_CHATBOT_HISTORY_MESSAGE_LENGTH, {
          tooLong: 'Chat history message is too long.',
        }),
      }),
    )
    .max(MAX_CHATBOT_HISTORY_MESSAGES, 'Chat history is too long.')
    .optional(),
});

export type ChatbotActionInput = z.infer<typeof ChatbotActionInputSchema>;

export type HandleChatbotResult =
  | { success: true; response: string }
  | ActionFailure;

export async function handleChatbot(data: ChatbotActionInput): Promise<HandleChatbotResult> {
  const requestId = newRequestId();

  const validation = ChatbotActionInputSchema.safeParse(data);
  if (!validation.success) {
    return invalidInput(requestId, validation.error, 'Invalid chatbot input.');
  }

  const limited = await enforceRateLimit('chatbot', requestId);
  if (limited) return limited;

  try {
    const out = await withTimeout(getChatbotResponse(validation.data), TIMEOUT_MS.chatbot);
    return { success: true, response: out.response };
  } catch (error: unknown) {
    return toFailure('handleChatbot', requestId, error, 'Chatbot failed. Please try again.');
  }
}

/* -------------------------------------------------------------------------- */
/* Text To Speech                                                             */
/* -------------------------------------------------------------------------- */

const TextToSpeechSchema = z.object({
  text: boundedText(MAX_TRANSLATION_TEXT_LENGTH, {
    min: 1,
    empty: 'Text cannot be empty.',
    tooLong: 'Text is too long for speech synthesis.',
  }),
  // BCP-47 style, e.g. "en", "hi-IN", "zh-Hans-CN"
  languageCode: z
    .string()
    .trim()
    .max(20, 'Invalid language code.')
    .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/, 'Invalid language code.')
    .optional(),
  voiceGender: z.enum(['MALE', 'FEMALE']).optional(),
  // e.g. "en-US-Neural2-F"
  voiceName: z
    .string()
    .trim()
    .min(1)
    .max(MAX_VOICE_NAME_LENGTH)
    .regex(/^[A-Za-z0-9._-]+$/, 'Invalid voice name.')
    .optional(),
});

export type TextToSpeechActionInput = z.infer<typeof TextToSpeechSchema>;

export type HandleTextToSpeechResult =
  | { success: true; audioDataUri: string | null; ssml: string | null }
  | ActionFailure;

export async function handleTextToSpeech(
  data: TextToSpeechActionInput,
): Promise<HandleTextToSpeechResult> {
  const requestId = newRequestId();

  const validation = TextToSpeechSchema.safeParse(data);
  if (!validation.success) {
    return invalidInput(requestId, validation.error, 'Invalid text-to-speech input.');
  }

  const limited = await enforceRateLimit('tts', requestId);
  if (limited) return limited;

  try {
    const out = await withTimeout(textToSpeech(validation.data), TIMEOUT_MS.tts);

    return {
      success: true,
      audioDataUri: out.audioDataUri ?? null,
      ssml: out.ssml ?? null,
    };
  } catch (error: unknown) {
    return toFailure(
      'handleTextToSpeech',
      requestId,
      error,
      'Text-to-speech failed. Please try again.',
    );
  }
}