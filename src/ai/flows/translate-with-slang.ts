"use server";

import Groq from "groq-sdk";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const STANDARD_MODEL = 'openai/gpt-oss-120b';
const SPEED_MODEL = 'openai/gpt-oss-20b';

const MAX_INPUT_LENGTH = 5_000;
const MAX_LANGUAGE_LENGTH = 100;
const MAX_SUGGESTIONS = 3;
const MAX_SUGGESTION_LENGTH = 300;

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

/**
 * Keep enough room for long translations while avoiding unnecessarily
 * large completions.
 *
 * The previous implementation used 1024 tokens and could fail when Groq
 * exhausted the completion budget before producing valid JSON.
 */
const MAX_COMPLETION_TOKENS = 1_536;

/* -------------------------------------------------------------------------- */
/* Validation schemas                                                        */
/* -------------------------------------------------------------------------- */

const TranslateInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Text cannot be empty.")
    .max(
      MAX_INPUT_LENGTH,
      `Text cannot exceed ${MAX_INPUT_LENGTH} characters.`,
    ),

  sourceLanguage: z
    .string()
    .trim()
    .min(1, "Source language is required.")
    .max(MAX_LANGUAGE_LENGTH),

  targetLanguage: z
    .string()
    .trim()
    .min(1, "Target language is required.")
    .max(MAX_LANGUAGE_LENGTH),

  isSpeedBoosted: z.boolean().optional().default(false),
});

/**
 * Runtime validation for the model response.
 *
 * Optional fields are normalized later so the client always receives
 * predictable values.
 */
const TranslateWithSlangOutputSchema = z.object({
  translation: z.string().trim(),

  detectedLanguageName: z
    .string()
    .trim()
    .max(MAX_LANGUAGE_LENGTH)
    .optional(),

  detectedLanguageCode: z
    .string()
    .trim()
    .max(20)
    .optional(),

  toneAnalysis: z
    .string()
    .trim()
    .max(500)
    .optional(),

  suggestions: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(MAX_SUGGESTION_LENGTH),
    )
    .max(MAX_SUGGESTIONS)
    .optional(),
});

export type TranslateWithSlangOutput = z.infer<
  typeof TranslateWithSlangOutputSchema
>;

export type TranslateWithSlangInput = z.infer<
  typeof TranslateInputSchema
>;

/* -------------------------------------------------------------------------- */
/* Groq client                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Create the client lazily instead of constructing it at module load time.
 *
 * Benefits:
 * - clearer configuration errors
 * - safer development/build environments
 * - avoids using a non-null assertion on GROQ_API_KEY
 */
let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  if (!groqClient) {
    groqClient = new Groq({
      apiKey,
      timeout: REQUEST_TIMEOUT_MS,
    });
  }

  return groqClient;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeLanguage(value: string): string {
  return value.trim().slice(0, MAX_LANGUAGE_LENGTH);
}

function isAutoDetectionLanguage(language: string): boolean {
  const normalized = language.trim().toLowerCase();

  return (
    normalized === "auto" ||
    normalized === "auto-detect" ||
    normalized === "automatic"
  );
}

/**
 * Removes accidental markdown fences while still allowing JSON returned
 * by the provider to be parsed normally.
 */
function cleanModelOutput(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Extract a JSON object if the provider accidentally adds surrounding text.
 *
 * response_format=json_object should normally make this unnecessary, but
 * keeping this small recovery path makes the translation flow more robust.
 */
function extractJsonObject(content: string): string {
  const cleaned = cleanModelOutput(content);

  if (
    cleaned.startsWith("{") &&
    cleaned.endsWith("}")
  ) {
    return cleaned;
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (
    firstBrace >= 0 &&
    lastBrace > firstBrace
  ) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

/**
 * Normalize the model response into the exact shape expected by the app.
 */
function normalizeOutput(
  value: unknown,
): TranslateWithSlangOutput {
  const parsed = TranslateWithSlangOutputSchema.parse(value);

  const translation = parsed.translation.trim();

  const suggestions = parsed.suggestions
    ?.map((suggestion) => suggestion.trim())
    .filter(Boolean)
    .slice(0, MAX_SUGGESTIONS);

  return {
    translation,

    detectedLanguageName:
      parsed.detectedLanguageName?.trim() || undefined,

    detectedLanguageCode:
      parsed.detectedLanguageCode?.trim() || undefined,

    toneAnalysis:
      parsed.toneAnalysis?.trim() || undefined,

    suggestions:
      suggestions && suggestions.length > 0
        ? suggestions
        : undefined,
  };
}

/**
 * Determine whether an error is likely transient and therefore worth retrying.
 */
function isRetryableError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;

    if (typeof status === "number") {
      return (
        status === 408 ||
        status === 409 ||
        status === 429 ||
        status >= 500
      );
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    return (
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("network") ||
      message.includes("econnreset") ||
      message.includes("socket")
    );
  }

  return false;
}


function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Executes a Groq request with a small bounded retry strategy.
 *
 * We deliberately do NOT retry validation errors or malformed application
 * input because those won't improve on another request.
 */
async function createCompletionWithRetry(
  client: Groq,
  model: string,
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[],
) {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt += 1
  ) {
    try {
      return await client.chat.completions.create({
        model,
        messages,
        response_format: {
          type: "json_object",
        },
        temperature: 0.2,
        max_tokens: MAX_COMPLETION_TOKENS,
      });
    } catch (error) {
      lastError = error;

      if (
        attempt >= MAX_RETRIES ||
        !isRetryableError(error)
      ) {
        throw error;
      }

      /**
       * Small exponential backoff:
       * attempt 0 -> 500ms
       * attempt 1 -> 1000ms
       */
      await wait(500 * 2 ** attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Groq request failed.");
}

/* -------------------------------------------------------------------------- */
/* Main translation function                                                  */
/* -------------------------------------------------------------------------- */

export async function translateWithSlang(
  input: TranslateWithSlangInput,
): Promise<TranslateWithSlangOutput> {
  try {
    /* ---------------------------------------------------------------------- */
    /* Validate input                                                         */
    /* ---------------------------------------------------------------------- */

    const validatedInput = TranslateInputSchema.parse(input);

    const text = validatedInput.text.trim();
    const sourceLanguage = normalizeLanguage(
      validatedInput.sourceLanguage,
    );
    const targetLanguage = normalizeLanguage(
      validatedInput.targetLanguage,
    );
    const isSpeedBoosted =
      validatedInput.isSpeedBoosted === true;

    if (!text) {
      throw new Error("Translation text cannot be empty.");
    }

    if (!targetLanguage) {
      throw new Error("Target language is required.");
    }

    /* ---------------------------------------------------------------------- */
    /* Model selection                                                        */
    /* ---------------------------------------------------------------------- */

    const model = isSpeedBoosted
      ? SPEED_MODEL
      : STANDARD_MODEL;

    const shouldDetectLanguage =
      isAutoDetectionLanguage(sourceLanguage);

    /* ---------------------------------------------------------------------- */
    /* System prompt                                                          */
    /* ---------------------------------------------------------------------- */

    /**
     * Keep this prompt intentionally compact.
     *
     * The previous prompt spent unnecessary completion budget describing
     * the schema in natural language while also requesting JSON. That
     * increases the chance of hitting the completion limit.
     */
    const systemPrompt = [
      "You are a professional multilingual translator.",
      `Translate the user's text into ${targetLanguage}.`,
      "Preserve meaning, intent, tone, slang, idioms, and formatting.",
      "Do not add explanations.",
      shouldDetectLanguage
        ? 'Detect the source language and return its name and ISO code.'
        : `The source language is ${sourceLanguage}; do not invent a different source language.`,
      isSpeedBoosted
        ? "Set toneAnalysis to an empty string and suggestions to an empty array."
        : "Provide a concise toneAnalysis and up to 3 useful alternative suggestions.",
      "",
      "Return ONLY a valid JSON object with exactly these keys:",
      '{"translation":"string","detectedLanguageName":"string","detectedLanguageCode":"string","toneAnalysis":"string","suggestions":["string"]}',
      "",
      "Rules:",
      "- translation must contain the complete translation.",
      "- Never put markdown around the JSON.",
      "- Never include commentary outside the JSON.",
      "- Keep suggestions concise.",
    ].join("\n");

    /* ---------------------------------------------------------------------- */
    /* Groq request                                                           */
    /* ---------------------------------------------------------------------- */

    const client = getGroqClient();

    const completion =
      await createCompletionWithRetry(
        client,
        model,
        [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: text,
          },
        ],
      );

    const rawContent =
      completion.choices?.[0]?.message?.content;

    if (
      typeof rawContent !== "string" ||
      rawContent.trim().length === 0
    ) {
      throw new Error(
        "Groq returned an empty translation response.",
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Parse and validate model output                                        */
    /* ---------------------------------------------------------------------- */

    let parsedJson: unknown;

    try {
      const jsonText = extractJsonObject(rawContent);

      parsedJson = JSON.parse(jsonText);
    } catch (parseError) {
      console.error(
        "[Translation JSON Parse Error]",
        {
          model,
          finishReason:
            completion.choices?.[0]?.finish_reason,
          usage: completion.usage,
          error: parseError,
        },
      );

      throw new Error(
        "Translation provider returned an invalid response.",
      );
    }

    const result = normalizeOutput(parsedJson);

    /* ---------------------------------------------------------------------- */
    /* Final application-level validation                                     */
    /* ---------------------------------------------------------------------- */

    if (!result.translation) {
      throw new Error(
        "Translation provider returned an empty translation.",
      );
    }

    /**
     * Speed mode deliberately returns empty analysis fields.
     * Keeping these values predictable makes the client simpler.
     */
    if (isSpeedBoosted) {
      return {
        translation: result.translation,
        detectedLanguageName:
          result.detectedLanguageName,
        detectedLanguageCode:
          result.detectedLanguageCode,
        toneAnalysis: "",
        suggestions: [],
      };
    }

    return result;
  } catch (error) {
    /**
     * Log the detailed provider error server-side only.
     *
     * Never expose API keys, raw provider responses, or internal
     * infrastructure details to the browser.
     */
    console.error("[Translation Service Error]", error);

    /**
     * Preserve user-friendly application errors where appropriate.
     */
    if (
      error instanceof z.ZodError
    ) {
      throw new Error(
        "The translation request contains invalid data.",
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "GROQ_API_KEY is not configured."
    ) {
      throw new Error(
        "Translation service is not configured.",
      );
    }

    throw new Error(
      "The translation service failed to respond. Please try again.",
    );
  }
}