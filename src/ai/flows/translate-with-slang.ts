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
    // Constructing the prompt dynamically as a system prompt.
    // This makes the logic more robust than using a Handlebars template.
    const systemPromptLines = [
      'You are a multilingual translator who specializes in understanding and translating slang terms and colloquialisms.',
    ];

    if (!input.isSpeedBoosted) {
      systemPromptLines.push('You also have expertise in emotional tone analysis.');
    }

    systemPromptLines.push('\nYour task is to translate a piece of text.');

    if (input.sourceLanguage === 'auto') {
      systemPromptLines.push('You must first accurately detect the source language of the text.');
    } else {
      systemPromptLines.push(`The user has specified the source language is ${input.sourceLanguage}. You should trust this and proceed with translation.`);
    }

    systemPromptLines.push(`\nThen, translate the text into ${input.targetLanguage}, ensuring that any slang terms or colloquialisms are accurately translated with culturally relevant equivalents. The goal is to make the translation sound natural and understandable to a native speaker of the target language.`);

    if (!input.isSpeedBoosted) {
      systemPromptLines.push('\nAfter that, analyze the emotional tone of the original source text. Describe it briefly in the \'toneAnalysis\' field.');
      systemPromptLines.push('If the tone could be perceived as negative, ambiguous, or could be improved (e.g., made more polite, professional, or clearer), provide up to three alternative phrasings in the \'suggestions\' array. If the tone is positive and clear, you can leave the suggestions array empty.');
    }

    if (input.sourceLanguage === 'auto') {
      systemPromptLines.push('\nIf you are auto-detecting, you must provide the full name and the most appropriate IETF language tag for the detected language in the output.');
    }
    
    const systemPrompt = systemPromptLines.join(' ');
    
    const { output } = await ai.generate({
      system: systemPrompt,
      prompt: `Text: ${input.text}`,
      output: {
        schema: TranslateWithSlangOutputSchema,
      },
    });

    if (!output) {
      throw new Error('The model failed to generate a valid translation. Please try again.');
    }
    return output;
  }
);
