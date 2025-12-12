"use server";

import { z } from "zod";
import Groq from "groq-sdk";
import Tesseract from "tesseract.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const TranslateImageOutputSchema = z.object({
  translation: z.string(),
});
export type TranslateImageOutput = z.infer<typeof TranslateImageOutputSchema>;

export async function translateImage(input: {
  photoDataUri: string;
  targetLanguage: string;
}): Promise<TranslateImageOutput> {
  try {
    // Remove base64 prefix
    const base64 = input.photoDataUri.replace(/^data:image\/\w+;base64,/, "");

    // Convert to a buffer
    const imgBuffer = Buffer.from(base64, "base64");

    // OCR: Extract text using Tesseract (FREE)
    const { data } = await Tesseract.recognize(imgBuffer, "eng"); // Can add multiple langs if needed
    const extractedText = data.text.trim();

    // If no text found
    if (!extractedText) {
      return { translation: "" };
    }

    // Now translate using Groq
    const systemPrompt = `
You are a translation model.
Translate the following extracted OCR text into ${input.targetLanguage}.
Return ONLY the translated text.
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: extractedText },
      ],
      temperature: 0.4,
      max_tokens: 512,
    });

    const translation = completion.choices[0]?.message?.content || "";

    return { translation };
  } catch (err) {
    console.error("[Optimized Image Translation Error]", err);
    throw new Error("Image translation failed. Please try again.");
  }
}
