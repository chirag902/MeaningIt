"use server";

import Groq from "groq-sdk";
import { z } from "zod";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const ChatbotInputSchema = z.object({
  userInput: z.string(),
  targetLanguage: z.string(),
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ).optional(),
});
export type ChatbotInput = z.infer<typeof ChatbotInputSchema>;

const ChatbotOutputSchema = z.object({
  response: z.string(),
});
export type ChatbotOutput = z.infer<typeof ChatbotOutputSchema>;

export async function getChatbotResponse(input: ChatbotInput): Promise<ChatbotOutput> {
  const isFirstMessage = !input.history || input.history.length === 0;

  const systemPrompt = `
You are Kai, a friendly, encouraging language tutor.
Always respond ONLY in ${input.targetLanguage}.
Keep responses short, natural, and conversational.
If the user makes a mistake, gently correct it by giving the natural phrasing in ${input.targetLanguage}.
${
  isFirstMessage
    ? `This is the user's first message. Introduce yourself warmly and ask what they want to talk about in ${input.targetLanguage}.`
    : ""
}
`.trim();

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...(input.history || []),
    { role: "user", content: input.userInput }
  ];

  try {
    const completion = await groq.chat.completions.create({
      model: "llama3-70b-8192",   // ⭐ STABLE, RECOMMENDED, NOT DECOMMISSIONED
      messages,
      temperature: 0.7,
      max_tokens: 250,
    });

    const response = completion.choices[0]?.message?.content || "";
    if (!response) throw new Error("Groq returned no response");

    return { response };

  } catch (err) {
    console.error("[Groq Chatbot Error]", err);
    return {
      response:
        "Sorry 😔, I couldn't process your request right now. Please try again shortly.",
    };
  }
}
