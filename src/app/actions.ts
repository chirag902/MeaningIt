// src/app/actions.ts
'use server';

import { z } from 'zod';
import { translateWithSlang, type TranslateWithSlangOutput } from '@/ai/flows/translate-with-slang';
import { translateImage } from '@/ai/flows/translate-image-flow';
import { getChatbotResponse } from '@/ai/flows/chatbot-flow';
import { textToSpeech } from '@/ai/flows/text-to-speech';

export type TranslateWithSlangInput = {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  isSpeedBoosted?: boolean;
};
const TranslateSchema = z.object({
  text: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  isSpeedBoosted: z.boolean().optional(),
});

export async function handleTranslation(data: TranslateWithSlangInput) {
  const validation = TranslateSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: 'Invalid translation input.' };
  }
  if (validation.data.text.trim().length === 0) {
    return { success: true, translation: '' };
  }

  try {
    const out: TranslateWithSlangOutput = await translateWithSlang(validation.data);
    return {
      success: true,
      translation: out.translation,
      detectedLanguageName: out.detectedLanguageName,
      detectedLanguageCode: out.detectedLanguageCode,
      toneAnalysis: out.toneAnalysis,
      suggestions: out.suggestions || [],
    };
  } catch (err: any) {
    console.error('[handleTranslation] error', err);
    return { success: false, error: err?.message || 'Translation failed.' };
  }
}
const TranslateImageSchema = z.object({
  photoDataUri: z.string(),
  targetLanguage: z.string(),
});
export type TranslateImageInput = z.infer<typeof TranslateImageSchema>;

export async function handleImageTranslation(data: TranslateImageInput) {
  const validation = TranslateImageSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: "Invalid image translation input." };
  }

  try {
    const out = await translateImage(validation.data);

    return {
      success: true,
      translation: out.translation,
    };
  } catch (err: any) {
    console.error("[handleImageTranslation] error", err);
    return { success: false, error: err?.message || "Image translation failed." };
  }
}


const ChatbotActionInputSchema = z.object({
  userInput: z.string(),
  targetLanguage: z.string(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      })
    )
    .optional(),
});
export async function handleChatbot(data: z.infer<typeof ChatbotActionInputSchema>) {
  const validation = ChatbotActionInputSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: 'Invalid chatbot input.' };
  }
  try {
    const out = await getChatbotResponse(validation.data);
    return { success: true, response: out.response };
  } catch (err: any) {
    console.error('[handleChatbot] error', err);
    return { success: false, error: err?.message || 'Chatbot failed.' };
  }
}

const TextToSpeechSchema = z.object({
  text: z.string(),
  languageCode: z.string().optional(),
  voiceGender: z.enum(['MALE', 'FEMALE']).optional(),
  voiceName: z.string().optional(),
});

export async function handleTextToSpeech(data: z.infer<typeof TextToSpeechSchema>) {
  const validation = TextToSpeechSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: 'Invalid TTS input.' };
  }

  try {
    const out = await textToSpeech(validation.data);
    return { success: true, audioDataUri: out.audioDataUri || null, ssml: out.ssml || null };
  } catch (err: any) {
    console.error('[handleTextToSpeech] error', err);
    return { success: false, error: err?.message || 'TTS failed.' };
  }
}
