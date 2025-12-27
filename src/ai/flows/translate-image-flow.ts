
"use server";

import Groq from "groq-sdk";
import Tesseract from "tesseract.js";
import { z } from "zod";

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
    // ----- PRIMARY OCR ENGINE (SERVER with tesseract.js) -----
    let extractedText = "";
    try {
      const result = await Tesseract.recognize(
        input.photoDataUri,
        "eng+hin+spa+fra+deu+ita+jpn+kor", 
        {
          // logger: m => console.log(m) 
        }
      );
      extractedText = result.data.text.trim();
    } catch (err) {
      console.error("[Server OCR Failed → Will fallback later]", err);
    }

    // If server OCR reads nothing → FORCE client fallback
    if (!extractedText) {
      return { translation: "__CLIENT_OCR_REQUIRED__" };
    }

    // ----- GROQ TRANSLATION -----
    const systemPrompt = `
Translate the following extracted text into ${input.targetLanguage}.
Return ONLY the translated text. No extra formatting.

Text:
${extractedText}
    `.trim();

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt }
      ],
      max_tokens: 512,
      temperature: 0.4,
    });

    const translated = completion.choices?.[0]?.message?.content?.trim() || "";

    return { translation: translated };
  } catch (err) {
    console.error("[Optimized Image Translation Error]", err);
    throw new Error("Image translation failed. Please try again.");
  }
}
