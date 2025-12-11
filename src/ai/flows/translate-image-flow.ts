'use server';

import { groq } from '@/ai/groq';
import { z } from 'zod';

const TranslateImageInputSchema = z.object({
  photoDataUri: z.string(),
  targetLanguage: z.string(),
});
export type TranslateImageInput = z.infer<typeof TranslateImageInputSchema>;

const TranslateImageOutputSchema = z.object({
  translation: z.string(),
});
export type TranslateImageOutput = z.infer<typeof TranslateImageOutputSchema>;

export async function translateImage(input: TranslateImageInput): Promise<TranslateImageOutput> {
  try {
    const prompt = `You are an expert at Optical Character Recognition (OCR) and multilingual translation.
  
1.  First, analyze the attached image and extract all visible text.
2.  The source language of the text is unknown, you must detect it.
3.  Translate the extracted text into ${input.targetLanguage}.
4.  If no text is found in the image, return an empty string for the translation.
5.  Return only the translated text as a JSON object with a "translation" key. For example: {"translation": "Your translated text here"}. You must only return the JSON object and nothing else.`;

    const response = await groq.chat.completions.create({
      model: 'llava-v1.5-7b-4096',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: input.photoDataUri,
              },
            },
          ],
        },
      ],
      max_tokens: 1024,
    });

    const output = response.choices[0]?.message?.content;
    if (!output) {
      throw new Error('The model failed to generate a valid translation from the image.');
    }
    
    // The model sometimes returns the JSON wrapped in markdown, so we need to extract it.
    const jsonString = output.replace(/```json\n?/, '').replace(/```$/, '');
    const parsed = JSON.parse(jsonString as string);
    return TranslateImageOutputSchema.parse(parsed);

  } catch (e: any) {
    console.error("Failed to parse image translation response:", e);
    console.error("Raw model output:", e.response?.choices[0]?.message?.content);
    throw new Error("The model returned an invalid format for the image translation. Please try again.");
  }
}
