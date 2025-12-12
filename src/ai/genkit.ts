/**
 * @fileoverview This file initializes the Genkit AI singleton with the Google AI plugin.
 *
 * It configures Genkit to use the Google AI provider, which is necessary for
 * accessing models like Gemini. The API key is sourced from environment variables.
 */
'use server';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Initialize Genkit with the Google AI plugin.
// This makes Google's AI models (like Gemini) available throughout the app.
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
});
