'use server';

import Groq from "groq-sdk";
import { z } from "zod";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

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

export async function translateWithSlang(
  input: TranslateWithSlangInput
): Promise<TranslateWithSlangOutput> {

  const model = input.isSpeedBoosted
    ? "llama-3.1-8b-instant"
    : "llama-3.3-70b-versatile";

  const systemPrompt = `
You are an expert multilingual translation AI.
Return output ONLY in this JSON format:

${TranslateWithSlangOutputSchema.toString()}

RULES:
1. Translate to ${input.targetLanguage}.
2. If sourceLanguage = "auto", detect it.
3. If isSpeedBoosted = true → skip toneAnalysis + suggestions.
`;

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input.text }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 1024,
    });

    const output = completion.choices[0]?.message?.content;
    if (!output) throw new Error("Empty response from Groq");

    return TranslateWithSlangOutputSchema.parse(JSON.parse(output));
  } catch (err) {
    console.error("[Groq Translation Error]", err);
    throw new Error("The translation service failed to respond. Please try again.");
  }
}
