'use server';

import { groq } from '@/ai/groq';
import { z } from 'zod';

const ChatbotInputSchema = z.object({
  userInput: z.string(),
  targetLanguage: z.string(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});
export type ChatbotInput = z.infer<typeof ChatbotInputSchema>;

const ChatbotOutputSchema = z.object({
  response: z.string(),
});
export type ChatbotOutput = z.infer<typeof ChatbotOutputSchema>;

export async function getChatbotResponse(input: ChatbotInput): Promise<ChatbotOutput> {
  const isFirstMessage = !input.history || input.history.length === 0;

  const systemPrompt = `
You are a friendly and encouraging language tutor. Your name is Kai.
Your goal is to help the user practice speaking in ${input.targetLanguage}.
ALWAYS respond in ${input.targetLanguage}, no matter what the user says.
Keep your responses conversational, concise, and natural.
If the user makes a small mistake, gently correct them by providing the correct phrasing.
For example, if they say "I is happy" in English, you could respond with:
"That's close! A more natural way to say that is 'I am happy'. What makes you happy today?".
Adapt this correction style to ${input.targetLanguage}.

${isFirstMessage
  ? `This is the first message. Introduce yourself and ask what the user wants to talk about in ${input.targetLanguage}.`
  : ''}
`.trim();

  const messages: any[] = [{ role: 'system', content: systemPrompt }];
  if (input.history) {
    messages.push(...input.history);
  }
  messages.push({ role: 'user', content: input.userInput });

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.2-90b-text-preview',
      temperature: 0.7,
      max_tokens: 200,
    });

    const response = chatCompletion.choices[0]?.message?.content || '';
    if (!response) {
      throw new Error('Groq did not return a response.');
    }
    return { response };
  } catch (error) {
    console.error('[Groq Chatbot Error]', error);
    return {
      response: "Sorry 😔, I couldn't process your request right now. Please try again shortly or check your network.",
    };
  }
}
