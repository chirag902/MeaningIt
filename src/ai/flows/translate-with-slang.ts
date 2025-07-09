'use server';

/**
 * @fileOverview A translation AI agent that translates with slang and colloquialisms.
 *
 * - translateWithSlang - A function that handles the translation process.
 * - TranslateWithSlangInput - The input type for the translateWithSlang function.
 * - TranslateWithSlangOutput - The return type for the translateWithSlang function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TranslateWithSlangInputSchema = z.object({
  text: z.string().describe('The text to translate.'),
  sourceLanguage: z.string().describe("The language of the text to translate. Can be 'auto' for auto-detection."),
  targetLanguage: z.string().describe('The language to translate the text into.'),
  isSpeedBoosted: z.boolean().optional().describe('If true, performs a faster translation by skipping tone analysis and suggestions.'),
});
export type TranslateWithSlangInput = z.infer<typeof TranslateWithSlangInputSchema>;

const TranslateWithSlangOutputSchema = z.object({
  translation: z.string().describe('The translated text, with slang terms accounted for.'),
  detectedLanguageName: z.string().optional().describe("The full name of the detected source language (e.g., 'French') if auto-detection was used."),
  detectedLanguageCode: z.string().optional().describe("The IETF language tag of the detected source language (e.g., 'fr-FR') if auto-detection was used."),
  toneAnalysis: z.string().optional().describe("A brief analysis of the emotional tone of the source text (e.g., 'Formal', 'Casual', 'Urgent', 'Frustrated')."),
  suggestions: z.array(z.string()).optional().describe("Alternative phrasings for the source text to improve the tone, if applicable. Provide up to 3 suggestions."),
});
export type TranslateWithSlangOutput = z.infer<typeof TranslateWithSlangOutputSchema>;

export async function translateWithSlang(input: TranslateWithSlangInput): Promise<TranslateWithSlangOutput> {
  return translateWithSlangFlow(input);
}

const translateWithSlangFlow = ai.defineFlow(
  {
    name: 'translateWithSlangFlow',
    inputSchema: TranslateWithSlangInputSchema,
    outputSchema: TranslateWithSlangOutputSchema,
  },
  async (input) => {
    const systemPrompt = `You are an expert multilingual translation AI.
Your task is to process the user's text based on the following rules:

1.  **TRANSLATION**: Translate the text into ${input.targetLanguage}. Ensure slang and colloquialisms are handled naturally.

2.  **LANGUAGE DETECTION**:
    -   If the source language is 'auto', you MUST detect it. Populate 'detectedLanguageName' and 'detectedLanguageCode' in the output.
    -   If the source language is specified as anything other than 'auto', trust it and do not perform detection. The detection fields can be null.

3.  **TONE ANALYSIS**:
    -   If 'isSpeedBoosted' is true, you MUST skip this step. The 'toneAnalysis' and 'suggestions' fields must be empty or null.
    -   If 'isSpeedBoosted' is false, you MUST analyze the emotional tone of the original text and populate 'toneAnalysis'.
    -   If the tone could be improved, provide up to 3 alternative phrasings in 'suggestions'. Otherwise, the array must be empty.

You must strictly follow these rules and return the data in the specified JSON format.`;

    const { output } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      system: systemPrompt,
      prompt: input.text,
      output: {
        format: 'json',
        schema: TranslateWithSlangOutputSchema,
      },
    });

    if (!output) {
      throw new Error('The model failed to generate a valid translation. Please try again.');
    }
    return output;
  }
);
