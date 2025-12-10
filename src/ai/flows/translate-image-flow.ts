'use server';

/**
 * @fileOverview An AI agent that performs OCR on an image and translates the text.
 *
 * - translateImage - A function that handles the image translation process.
 * - TranslateImageInput - The input type for the translateImage function
 * - TranslateImageOutput - The return type for the translateImage function
 */

import {ai} from '@/ai/genkit';
import {googleAI} from '@genkit-ai/google-genai';
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

const translateImageFlow = ai.defineFlow(
  {
    name: 'translateImageFlow',
    inputSchema: TranslateImageInputSchema,
    outputSchema: TranslateImageOutputSchema,
  },
  async ({ photoDataUri, targetLanguage }) => {
    const prompt = `You are an expert at Optical Character Recognition (OCR) and multilingual translation.
  
1.  First, analyze the attached image and extract all visible text.
2.  The source language of the text is unknown, you must detect it.
3.  Translate the extracted text into ${targetLanguage}.
4.  If no text is found in the image, return an empty string for the translation.
5.  Return only the translated text as a JSON object with a "translation" key. For example: {"translation": "Your translated text here"}. You must only return the JSON object and nothing else.`;

    const result = await ai.generate({
      model: googleAI.model('gemini-1.5-flash'),
      prompt: [
            { text: prompt },
            { media: { url: photoDataUri } }
      ],
    });

    const output = result.output();
    if (!output) {
      throw new Error('The model failed to generate a valid translation from the image. Please try again.');
    }
    
    try {
      // The model sometimes returns the JSON wrapped in markdown, so we need to extract it.
      const jsonString = output.text?.replace(/```json\n?/, '')?.replace(/```$/, '');
      const parsed = JSON.parse(jsonString as string);
      return TranslateImageOutputSchema.parse(parsed);
    } catch (e) {
      console.error("Failed to parse image translation response:", e);
      console.error("Raw model output:", output.text);
      throw new Error("The model returned an invalid format for the image translation. Please try again.");
    }
  }
);
