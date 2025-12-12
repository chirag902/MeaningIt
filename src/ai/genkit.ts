/**
 * @fileoverview This file initializes the Genkit AI singleton with the Google AI plugin.
 *
 * It configures Genkit to use the Google AI provider, which is necessary for
 * accessing models like Gemini. The API key is sourced from environment variables.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import credentials from '@/../keys/google-vision.json';

// Initialize Genkit with the Google AI plugin.
// This makes Google's AI models (like Gemini) available throughout the app.
export const ai = genkit({
  plugins: [
    googleAI({
      credentials,
    }),
  ],
  // Log all AI activity to the console for debugging.
  logLevel: 'debug',
  // Prevent telemetry data from being sent to Google.
  enableTracingAndMetrics: false,
});
