'use server';
/**
 * @fileoverview Implements the image translation feature using Google's Gemini model via Genkit.
 *
 * - translateImage - A function that handles the image-to-text translation process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GEMINI_VISION_MODEL = 'gemini-1.5-flash-latest';

// Define the schema for the function's input.
const TranslateImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of text to be translated, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  targetLanguage: z.string().describe('The language to translate the text into.'),
});
export type TranslateImageInput = z.infer<typeof TranslateImageInputSchema>;

// Define the schema for the function's output.
const TranslateImageOutputSchema = z.object({
  translation: z.string().describe('The translated text from the image.'),
});
export type TranslateImageOutput = z.infer<typeof TranslateImageOutputSchema>;

// Define the main function that will be called from the UI.
export async function translateImage(input: TranslateImageInput): Promise<TranslateImageOutput> {
  // Use a structured prompt to get a structured JSON output.
  const { output } = await ai.generate({
    model: GEMINI_VISION_MODEL,
    prompt: [
      {
        text: `
          You are an expert OCR + translation model.

          Task:
          1. Read all text inside the given image.
          2. Detect the original language.
          3. Translate the extracted text into ${input.targetLanguage}.
          4. If no readable text exists, the translation should be an empty string.
        `,
      },
      { media: { url: input.photoDataUri } },
    ],
    output: {
      schema: TranslateImageOutputSchema,
    },
    config: {
      temperature: 0.1, // Lower temperature for more predictable, factual output.
    },
  });

  // Ensure the output is not null.
  return output || { translation: '' };
}
