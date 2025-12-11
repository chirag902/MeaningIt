// src/ai/flows/text-to-speech.ts
'use server';

import { z } from 'zod';

const TextToSpeechInputSchema = z.object({
  text: z.string().min(1),
  languageCode: z.string().optional(), // e.g., "en-US"
  voiceGender: z.enum(['MALE', 'FEMALE']).optional(),
  voiceName: z.string().optional(),
});
export type TextToSpeechInput = z.infer<typeof TextToSpeechInputSchema>;

const TextToSpeechOutputSchema = z.object({
  // audioDataUri is base64 data URI (e.g., data:audio/wav;base64,...)
  audioDataUri: z.string().nullable(),
  // If server could not produce binary audio, provide SSML or text for client fallback
  ssml: z.string().optional(),
});
export type TextToSpeechOutput = z.infer<typeof TextToSpeechOutputSchema>;

/**
 * Server TTS flow:
 * - If process.env.TTS_API_URL is set, call it (POST) with {text, languageCode, voiceGender, voiceName}
 *   and expect a JSON response with { audioBase64, mime } or { audioDataUri }.
 * - If no TTS_API_URL set, return null audioDataUri and provide SSML so the client can fallback to SpeechSynthesis or other.
 */

export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
  const validated = TextToSpeechInputSchema.parse(input);

  const ttsApiUrl = process.env.TTS_API_URL || '';
  const ttsApiKey = process.env.TTS_API_KEY || '';

  // Build an SSML snippet using simple template (used as fallback or to send to external TTS)
  const ssml = `<speak>${escapeXml(validated.text)}</speak>`;

  if (!ttsApiUrl) {
    // No server TTS provider configured — return SSML so client can fallback to Web Speech API
    return TextToSpeechOutputSchema.parse({ audioDataUri: null, ssml });
  }

  try {
    const res = await fetch(ttsApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ttsApiKey ? { Authorization: `Bearer ${ttsApiKey}` } : {}),
      },
      body: JSON.stringify({
        text: validated.text,
        ssml,
        languageCode: validated.languageCode || 'en-US',
        voiceGender: validated.voiceGender || 'FEMALE',
        voiceName: validated.voiceName,
        format: 'wav',
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[TTS provider error]', res.status, body);
      // Graceful fallback: return SSML for client
      return TextToSpeechOutputSchema.parse({ audioDataUri: null, ssml });
    }

    // Expect provider to return JSON: { audioBase64: '...', mime: 'audio/wav' } or { audioDataUri: 'data:...' }
    const json = (await res.json().catch(() => null)) as any;
    if (!json) {
      console.error('[TTS provider] invalid JSON response');
      return TextToSpeechOutputSchema.parse({ audioDataUri: null, ssml });
    }

    if (json.audioDataUri && typeof json.audioDataUri === 'string') {
      return TextToSpeechOutputSchema.parse({ audioDataUri: json.audioDataUri });
    }

    if (json.audioBase64 && json.mime) {
      const audioDataUri = `data:${json.mime};base64,${json.audioBase64}`;
      return TextToSpeechOutputSchema.parse({ audioDataUri });
    }

    // provider returned unexpected format — fallback to SSML
    console.warn('[TTS provider] unexpected response shape', Object.keys(json));
    return TextToSpeechOutputSchema.parse({ audioDataUri: null, ssml });
  } catch (err) {
    console.error('[TTS flow error]', err);
    return TextToSpeechOutputSchema.parse({ audioDataUri: null, ssml });
  }
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
