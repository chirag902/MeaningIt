"use server";

import Groq from "groq-sdk";
import { z } from "zod";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const TranslateImageInputSchema = z.object({
  photoDataUri: z.string(),
  targetLanguage: z.string(),
});
export type TranslateImageInput = z.infer<typeof TranslateImageInputSchema>;

const TranslateImageOutputSchema = z.object({
  translation: z.string(),
});
export type TranslateImageOutput = z.infer<typeof TranslateImageOutputSchema>;

export async function translateImage(
  input: TranslateImageInput
): Promise<TranslateImageOutput> {
  const prompt = `
You are an expert OCR + translation AI.

Task:
1. Read all visible text from the attached image.
2. Detect the source language automatically.
3. Translate the extracted text into ${input.targetLanguage}.
4. If no text exists, return {"translation": ""}.
5. Return ONLY a JSON object: {"translation": "text here"}. No markdown.
`;

  try {
    const result = await groq.chat.completions.create({
      model: "llama-3.2-90b-vision", // ⭐ CORRECT GROQ OCR MODEL
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: input.photoDataUri },
            },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.2,
    });

    const raw = result.choices[0]?.message?.content;
    if (!raw) throw new Error("Model returned empty response.");

    // Clean markdown
    const jsonString = raw
      .replace(/```json\n?/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(jsonString);

    return TranslateImageOutputSchema.parse(parsed);
  } catch (err: any) {
    console.error("Failed to translate image:", err);
    throw new Error("Image translation failed. Please try again.");
  }
}
