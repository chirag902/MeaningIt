'use server';

import Groq from "groq-sdk";
import { z } from "zod";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const TranslateWithSlangOutputSchema = z.object({
  translation: z.string(),
  detectedLanguageName: z.string().optional(),
  detectedLanguageCode: z.string().optional(),
  toneAnalysis: z.string().optional(),
  suggestions: z.array(z.string()).optional(),
});

export type TranslateWithSlangOutput = z.infer<typeof TranslateWithSlangOutputSchema>;

export async function translateWithSlang(input: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  isSpeedBoosted?: boolean;
}): Promise<TranslateWithSlangOutput> {

  const model = input.isSpeedBoosted
    ? "llama-3.1-8b-instant"
    : "llama-3.3-70b-versatile";

  const systemPrompt = `
You are an elite multilingual translator.

You MUST:
1. Translate the user’s text into **${input.targetLanguage}**.
2. Translate naturally, including slang if present.
3. If sourceLanguage = "auto", detect language and fill:
   - detectedLanguageName
   - detectedLanguageCode
4. If isSpeedBoosted = true:
   - toneAnalysis = ""
   - suggestions = []

Return ONLY valid JSON:

{
  "translation": "string",
  "detectedLanguageName": "string?",
  "detectedLanguageCode": "string?",
  "toneAnalysis": "string?",
  "suggestions": ["string"]?
}

NO markdown. NO explanations. ONLY JSON.
`.trim();

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Text: "${input.text}"` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 1024,
    });

    let jsonText = completion.choices[0]?.message?.content;
    if (!jsonText) throw new Error("Groq returned empty output.");

    jsonText = jsonText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonText);

    if (!parsed.translation || typeof parsed.translation !== "string") {
      parsed.translation = "";
    }

    return TranslateWithSlangOutputSchema.parse(parsed);

  } catch (err) {
    console.error("[Groq Translation Error]", err);
    throw new Error("The translation service failed to respond. Please try again.");
  }
}
