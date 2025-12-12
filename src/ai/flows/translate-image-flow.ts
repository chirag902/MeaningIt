'use server';

import { ImageAnnotatorClient } from "@google-cloud/vision";
import Groq from "groq-sdk";
import { z } from "zod";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
const visionClient = new ImageAnnotatorClient();

// Zod schema for validated output
const TranslateImageOutputSchema = z.object({
  translation: z.string(),
  detectedLanguage: z.string().optional(),
  rawText: z.string().optional(),
});
export type TranslateImageOutput = z.infer<typeof TranslateImageOutputSchema>;

export async function translateImage(input: {
  photoDataUri: string;
  targetLanguage: string;
}): Promise<TranslateImageOutput> {
  try {
    // 🔹 Step 1: Parse Base64
    const base64Data = input.photoDataUri.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    // 🔹 Step 2: OCR using Google Cloud Vision
    const [result] = await visionClient.textDetection({
      image: { content: imageBuffer },
    });

    const rawText = result.fullTextAnnotation?.text?.trim() || "";

    // No text → return empty translation
    if (!rawText) {
      return {
        translation: "",
        detectedLanguage: "unknown",
        rawText: "",
      };
    }

    // 🔹 Step 3: Detect language using Groq
    const detectPrompt = `
Detect the language of the following text.
Return ONLY the language name (e.g., "Spanish", "French", "Hindi").

Text:
${rawText}
`.trim();

    const detect = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a strict language detector." },
        { role: "user", content: detectPrompt },
      ],
      max_tokens: 20,
      temperature: 0,
    });

    const detectedLanguage =
      detect.choices[0]?.message?.content?.trim() || "unknown";

    // 🔹 Step 4: Translate OCR text
    const translatePrompt = `
You are a world-class professional translator.

Translate the following OCR-extracted text into **${input.targetLanguage}**.
Maintain meaning, tone, and clarity.
Fix punctuation and formatting.
DO NOT hallucinate or add content.

Text:
${rawText}
`.trim();

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a precise translation engine." },
        { role: "user", content: translatePrompt },
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    const translatedText =
      completion.choices[0]?.message?.content?.trim() || "";

    return TranslateImageOutputSchema.parse({
      translation: translatedText,
      detectedLanguage,
      rawText,
    });

  } catch (err) {
    console.error("[Optimized Image Translation Error]", err);
    throw new Error("Image translation failed. Please try again.");
  }
}
