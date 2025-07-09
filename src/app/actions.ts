'use server';

import { translateWithSlang, type TranslateWithSlangInput } from '@/ai/flows/translate-with-slang';
import { translateImage, type TranslateImageInput } from '@/ai/flows/translate-image-flow';
import { textToSpeech, type TextToSpeechInput } from '@/ai/flows/text-to-speech-flow';
import { getChatbotResponse, type ChatbotInput } from '@/ai/flows/chatbot-flow';
import { z } from 'zod';

const TranslateSchema = z.object({
  text: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  isSpeedBoosted: z.boolean().optional(),
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
    return { 
        success: true, 
        translation: result.translation,
        detectedLanguageName: result.detectedLanguageName,
        detectedLanguageCode: result.detectedLanguageCode,
        toneAnalysis: result.toneAnalysis,
        suggestions: result.suggestions,
    };
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

const TextToSpeechSchema = z.object({
    text: z.string(),
});
  
export async function handleTextToSpeech(data: TextToSpeechInput) {
    const validation = TextToSpeechSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: 'Invalid input.' };
    }
    
    if (data.text.trim().length === 0) {
        return { success: true, audioDataUri: '' };
    }
    
    try {
        const result = await textToSpeech(validation.data);
        return { success: true, audioDataUri: result.audioDataUri };
    } catch (error) {
        console.error('Text-to-speech failed:', error);
        return { success: false, error: 'Failed to synthesize speech. Please try again.' };
    }
}

const ChatbotActionInputSchema = z.object({
    userInput: z.string(),
    targetLanguage: z.string(),
    history: z.array(z.object({
        role: z.enum(['user', 'model']),
        text: z.string(),
    })).optional(),
});

export async function handleChatbot(data: z.infer<typeof ChatbotActionInputSchema>) {
    const validation = ChatbotActionInputSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: 'Invalid input.' };
    }
    
    const genkitHistory = data.history?.map(turn => ({
        role: turn.role,
        parts: [{ text: turn.text }],
    }));

    try {
        const result = await getChatbotResponse({
            userInput: data.userInput,
            targetLanguage: data.targetLanguage,
            history: genkitHistory,
        });
        return { success: true, response: result.response };
    } catch (error) {
        console.error('Chatbot failed:', error);
        return { success: false, error: 'Chatbot failed to respond. Please try again.' };
    }
}
