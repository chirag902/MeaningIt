'use server';

/**
 * @fileOverview An AI agent that performs OCR on an image and translates the text.
 *
 * - translateImage - A function that handles the image translation process.
 * - TranslateImageInput - The input type for the translateImage function.
 * - TranslateImageOutput - The return type for the translateImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TranslateImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo containing text, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  targetLanguage: z.string().describe('The language to translate the text into.'),
});
export type TranslateImageInput = z.infer<typeof TranslateImageInputSchema>;

const TranslateImageOutputSchema = z.object({
  translation: z.string().describe('The translated text from the image.'),
});
export type TranslateImageOutput = z.infer<typeof TranslateImageOutputSchema>;

export async function translateImage(input: TranslateImageInput): Promise<TranslateImageOutput> {
  return translateImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'translateImagePrompt',
  input: {schema: TranslateImageInputSchema},
  output: {schema: TranslateImageOutputSchema},
  prompt: `You are an expert at Optical Character Recognition (OCR) and multilingual translation.
  
  1.  First, analyze the attached image and extract all visible text.
  2.  The source language of the text is unknown, you must detect it.
  3.  Translate the extracted text into {{targetLanguage}}.
  4.  If no text is found in the image, return an empty string for the translation.
  5.  Return only the translated text.
  
  Image: {{media url=photoDataUri}}`,
});

const translateImageFlow = ai.defineFlow(
  {
    name: 'translateImageFlow',
    inputSchema: TranslateImageInputSchema,
    outputSchema: TranslateImageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('The model failed to generate a valid translation from the image. Please try again.');
    }
    return output;
  }
);
