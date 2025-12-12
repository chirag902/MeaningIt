'use server';

import Groq from "groq-sdk";
import { z } from "zod";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

// Output schema
const TranslateImageOutputSchema = z.object({
  translation: z.string(),
});
export type TranslateImageOutput = z.infer<typeof TranslateImageOutputSchema>;

export async function translateImage(input: {
  photoDataUri: string;
  targetLanguage: string;
}): Promise<TranslateImageOutput> {
  try {
    const prompt = `
You are an OCR + translation expert.

1. Extract ALL readable text from the image.
2. Detect the language automatically.
3. Translate the extracted text into: ${input.targetLanguage}.
4. If the image has no text, return "".

Return ONLY JSON:
{
  "translation": "string"
}
`.trim();

    const completion = await groq.chat.completions.create({
      model: "llava-1.6-v1.1-34b",
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract and translate this image." },
            {
              type: "image_url",
              image_url: { url: input.photoDataUri },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    let json = completion.choices[0]?.message?.content;
    if (!json) throw new Error("Empty response from Groq Vision");

    json = json.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(json);

    return TranslateImageOutputSchema.parse(parsed);

  } catch (err) {
    console.error("[Groq Vision Error]", err);
    throw new Error("Image translation failed. Please try again.");
  }
}
