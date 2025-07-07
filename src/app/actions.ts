'use server';

import { translateWithSlang, type TranslateWithSlangInput } from '@/ai/flows/translate-with-slang';
import { translateImage, type TranslateImageInput } from '@/ai/flows/translate-image-flow';
import { z } from 'zod';

const TranslateSchema = z.object({
  text: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
});

export async function handleTranslation(data: TranslateWithSlangInput) {
  const validation = TranslateSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: 'Invalid input.' };
  }

  if(data.text.trim().length === 0) {
    return { success: true, translation: '' };
  }

  try {
    const result = await translateWithSlang(validation.data);
    return { success: true, translation: result.translation };
  } catch (error) {
    console.error('Translation failed:', error);
    return { success: false, error: 'Failed to translate. Please try again later.' };
  }
}

const TranslateImageSchema = z.object({
    photoDataUri: z.string(),
    targetLanguage: z.string(),
});

export async function handleImageTranslation(data: TranslateImageInput) {
    const validation = TranslateImageSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: 'Invalid input.' };
    }

    try {
        const result = await translateImage(validation.data);
        return { success: true, translation: result.translation };
    } catch (error) {
        console.error('Image translation failed:', error);
        return { success: false, error: 'Failed to translate image. Please try again.' };
    }
}
