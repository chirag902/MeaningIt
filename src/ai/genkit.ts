// src/ai/genkit.ts
'use server';

/**
 * Central Groq AI client for the entire app.
 * Keeping this isolated prevents multiple instances,
 * reduces bugs, and ensures consistent configuration.
 */
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import Groq from 'groq-sdk';

// Enforce clean startup — no silent errors.
if (!process.env.GROQ_API_KEY) {
  throw new Error(
    '❌ Missing GROQ_API_KEY in environment.\n' +
      'Add it to your .env file: GROQ_API_KEY="your_groq_key_here"'
  );
}

// Create ONE Groq client for the whole app
export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Helper for text generation (chat completions).
 */
export async function groqChat({
  model,
  messages,
  temperature = 0.4,
  max_tokens = 2048,
}: {
  model: string;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
}) {
  const completion = await groq.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens,
  });

  return completion.choices[0]?.message?.content ?? '';
}

/**
 * Helper for structured JSON output.
 */
export async function groqJSON<T>({
  model,
  messages,
  temperature = 0.2,
  max_tokens = 2048,
}: {
  model: string;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
}): Promise<T> {
  const completion = await groq.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';

  return JSON.parse(raw) as T;
}
