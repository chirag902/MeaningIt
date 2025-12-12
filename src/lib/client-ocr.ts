// src/lib/client-ocr.ts
'use client';

import Tesseract from 'tesseract.js';

/**
 * Runs Tesseract OCR in the browser on a given image data URI.
 * @param photoDataUri The data URI of the image to process.
 * @returns The extracted text, trimmed.
 */
export async function runClientOCR(photoDataUri: string): Promise<string> {
  try {
    console.log('Starting client-side OCR...');
    const result = await Tesseract.recognize(
      photoDataUri,
      'eng+spa+fra+deu+jpn+kor+hin+ita', // Common languages
      {
        // logger: (m) => console.log('Client OCR progress:', m),
      }
    );
    console.log('Client-side OCR finished.');
    return result.data.text.trim();
  } catch (error) {
    console.error('Client-side OCR failed:', error);
    return ''; // Return empty string on failure
  }
}
