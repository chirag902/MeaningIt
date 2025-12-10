'use server';

import { groq } from '@/ai/groq';
import { z } from 'zod';

const TranslateWithSlangInputSchema = z.object({
  text: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  isSpeedBoosted: z.boolean().optional(),
});
export type TranslateWithSlangInput = z.infer<typeof TranslateWithSlangInputSchema>;

const TranslateWithSlangOutputSchema = z.object({
  translation: z.string(),
  detectedLanguageName: z.string().optional(),
  detectedLanguageCode: z.string().optional(),
  toneAnalysis: z.string().optional(),
  suggestions: z.array(z.string()).optional(),
});
export type TranslateWithSlangOutput = z.infer<typeof TranslateWithSlangOutputSchema>;


export async function translateWithSlang(input: TranslateWithSlangInput): Promise<TranslateWithSlangOutput> {
  const systemPrompt = `You are an expert multilingual translation AI.
Your task is to process the user's text and return a JSON object that follows this Zod schema: ${TranslateWithSlangOutputSchema.toString()}.

Here are the rules for populating the JSON object:

1.  **TRANSLATION**: Translate the text into ${input.targetLanguage}. Ensure slang and colloquialisms are handled naturally.

2.  **LANGUAGE DETECTION**:
    -   If the source language is 'auto', you MUST detect it. Populate 'detectedLanguageName' (e.g., 'French') and 'detectedLanguageCode' (e.g., 'fr-FR') in the output.
    -   If the source language is specified as anything other than 'auto', trust it and do not perform detection. The detection fields can be null.

3.  **TONE ANALYSIS**:
    -   If 'isSpeedBoosted' is true, you MUST skip this step. The 'toneAnalysis' and 'suggestions' fields must be empty or null.
    -   If 'isSpeedBoosted' is false, you MUST analyze the emotional tone of the original text (e.g., 'Formal', 'Casual', 'Urgent', 'Frustrated') and populate 'toneAnalysis'.
    -   If the tone could be improved, provide up to 3 alternative phrasings in 'suggestions'. Otherwise, the array must be empty.

You must strictly follow these rules and only return the JSON object. Do not add any commentary or markdown formatting.`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Translate this text: "${input.text}"` },
      ],
      model: input.isSpeedBoosted ? 'llama-3.2-11b-text-preview' : 'llama-3.2-90b-text-preview',
      temperature: 0.5,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    });

    const output = chatCompletion.choices[0]?.message?.content;
    if (!output) {
      throw new Error('Groq did not return a response.');
    }
    
    const parsed = JSON.parse(output);
    return TranslateWithSlangOutputSchema.parse(parsed);

  } catch (error) {
    console.error('[Groq Translation Error]', error);
    throw new Error("The translation service failed to respond. Please try again.");
  }
}
