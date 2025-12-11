// src/ai/flows/translate-image-flow.ts
'use server';

import Groq from 'groq-sdk';
import { z } from 'zod';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

const TranslateImageInputSchema = z.object({
  photoDataUri: z.string().min(1), // data:image/... base64
  targetLanguage: z.string().min(2),
});
export type TranslateImageInput = z.infer<typeof TranslateImageInputSchema>;

const TranslateImageOutputSchema = z.object({
  translation: z.string(),
});
export type TranslateImageOutput = z.infer<typeof TranslateImageOutputSchema>;

const DEFAULT_IMAGE_MODEL = 'llama-3.2-11b-vision-preview';
const MAX_TOKENS = Number(process.env.GROQ_IMAGE_MAX_TOKENS || 512);

export async function translateImage(input: TranslateImageInput): Promise<TranslateImageOutput> {
  const validated = TranslateImageInputSchema.parse(input);

  const systemPrompt = `
You are an expert OCR + translator. Extract any visible text from the provided image, detect its language if unknown,
then translate that text into ${validated.targetLanguage}. Return ONLY a JSON object:
{ "translation": "<translated text here>" }
If no translatable text exists, return { "translation": "" } (empty string).
Do not include explanation or other fields.
`.trim();

  try {
    const completion = await groq.chat.completions.create({
      model: DEFAULT_IMAGE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Translate the image content to the target language.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${validated.photoDataUri.replace(/^data:image\/\w+;base64,/, '')}`,
              }
            },
          ],
        },
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    let modelOutput = completion.choices?.[0]?.message?.content;
    if (!modelOutput) throw new Error('Empty response from vision model');

    // If output is object already, accept it, otherwise attempt to extract JSON string.
    if (typeof modelOutput === 'string') {
      // Clean triple-backticks or markdown if any
      modelOutput = modelOutput.replace(/```json|```/gi, '').trim();
      try {
        const parsed = JSON.parse(modelOutput);
        return TranslateImageOutputSchema.parse(parsed);
      } catch (e) {
        // Not JSON — assume plain string is the translated caption
        const fallback = { translation: (modelOutput as string).trim() };
        return TranslateImageOutputSchema.parse(fallback);
      }
    } else if (typeof modelOutput === 'object') {
      return TranslateImageOutputSchema.parse(modelOutput as any);
    } else {
      throw new Error('Unsupported model output type');
    }
  } catch (err) {
    console.error('[Groq Vision/Translate Error]', err);
    throw new Error('Image translation failed. Please try again.');
  }
}
