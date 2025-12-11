// src/ai/flows/chatbot-flow.ts
'use server';

import Groq from 'groq-sdk';
import { z } from 'zod';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

const ChatbotInputSchema = z.object({
  userInput: z.string().min(0),
  targetLanguage: z.string().min(2),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      })
    )
    .optional(),
});
export type ChatbotInput = z.infer<typeof ChatbotInputSchema>;

const ChatbotOutputSchema = z.object({
  response: z.string(),
});
export type ChatbotOutput = z.infer<typeof ChatbotOutputSchema>;

const DEFAULT_MODEL = process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile';
const MAX_TOKENS = Number(process.env.GROQ_CHAT_MAX_TOKENS || 400);

export async function getChatbotResponse(input: ChatbotInput): Promise<ChatbotOutput> {
  const validated = ChatbotInputSchema.parse(input);

  const systemPrompt = `
You are Kai, a friendly and encouraging language tutor.
Always reply in ${validated.targetLanguage}. Do not switch languages.
Be concise, natural, and helpful. If the user makes a small grammar or usage mistake,
gently provide a correction and an alternative phrasing in the same language.
Keep responses short and conversational.
`;

  const messages: any[] = [{ role: 'system', content: systemPrompt }];
  if (validated.history?.length) messages.push(...validated.history);
  messages.push({ role: 'user', content: validated.userInput });

  try {
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_CHAT_MODEL || DEFAULT_MODEL,
      messages,
      temperature: 0.5,
      max_tokens: MAX_TOKENS,
    });

    const reply = completion.choices?.[0]?.message?.content;
    if (!reply || typeof reply !== 'string') {
      throw new Error('Empty or invalid response from model');
    }

    return ChatbotOutputSchema.parse({ response: reply.trim() });
  } catch (err) {
    console.error('[Groq Chatbot Error]', err);
    // graceful fallback message so client can show something reasonable
    return ChatbotOutputSchema.parse({
      response:
        "Sorry — I couldn't respond right now. Please try again in a moment.",
    });
  }
}
