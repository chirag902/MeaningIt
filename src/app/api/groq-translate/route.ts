// src/app/api/groq-translate/route.ts
import { NextResponse } from 'next/server';
import { groq } from '@/ai/groq';

/**
 * API route for simple text translation using Groq.
 * This is used as a fallback by the client-side OCR process.
 */
export async function POST(request: Request) {
  try {
    const { text, targetLanguage } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: 'Missing text or targetLanguage' },
        { status: 400 }
      );
    }

    const systemPrompt = `
Translate the following text into ${targetLanguage}.
Return ONLY the translated text. No extra formatting or explanations.

Text:
${text}
    `.trim();

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant', // Fast model for quick client-side fallback
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const translation = completion.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({ translation });
  } catch (error) {
    console.error('[Groq Translate API Error]', error);
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}
