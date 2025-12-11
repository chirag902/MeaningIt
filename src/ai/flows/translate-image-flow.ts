// src/ai/flows/translate-image-flow.ts
'use server';

import Groq from "groq-sdk";
import { z } from 'zod';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const TranslateImageInputSchema = z.object({
  photoDataUri: z.string().min(1), // data:image/... base64
  targetLanguage: z.string().min(2),
});
export type TranslateImageInput = z.infer<typeof TranslateImageInputSchema>;


const TranslateImageOutputSchema = z.object({
  translation: z.string(),
});
export type TranslateImageOutput = z.infer<typeof TranslateImageOutputSchema>;


const VISION_MODEL = "llama-3.3-70b-vision";

export async function translateImage(input: TranslateImageInput): Promise<TranslateImageOutput> {

  const validated = TranslateImageInputSchema.parse(input);

  const systemPrompt = `
You are an expert OCR + translation model.

Task:
1. Read all text inside the given image.
2. Detect the original language.
3. Translate the extracted text into ${validated.targetLanguage}.
4. If no readable text exists → return {"translation": ""}

Return ONLY a JSON object:
{
  "translation": "string"
}
`.trim();

  try {
    const completion = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract and translate this image." },
            {
              type: "image_url",
              image_url: { url: validated.photoDataUri },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1024,
      temperature: 0.2,
    });

    let output = completion.choices[0]?.message?.content;
    if (!output) throw new Error("Groq returned empty OCR output.");

    // Remove markdown wrappers if present
    output = output.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(output);

    if (typeof parsed.translation !== "string") {
      parsed.translation = "";
    }

    return TranslateImageOutputSchema.parse(parsed);

  } catch (err) {
    console.error("[Groq Vision/Translate Error]", err);
    throw new Error("Image translation failed. Please try again.");
  }
}
