'use client';

import { createWorker, type Worker } from 'tesseract.js';

/**
 * MeaningIt browser OCR.
 *
 * API (backwards compatible):
 *   runClientOCR(photoDataUri)                       -> English
 *   runClientOCR(photoDataUri, 'hin' | 'eng+hin')    -> chosen language(s)
 *   runClientOCR(photoDataUri, 'eng', { signal })    -> cancellable
 *   preloadOCR(language?)                            -> warm the worker
 *   terminateOCR()                                   -> free all workers
 *
 * Optional env: NEXT_PUBLIC_TESSDATA_PATH to self-host traineddata files
 * (recommended for production: faster, no third-party CDN dependency).
 */

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const MAX_INPUT_DATA_URI_LENGTH = 12 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2000;
const MAX_TEXT_LENGTH = 8_000;
const DEFAULT_LANGUAGE = 'eng';
const MAX_COMBINED_LANGUAGES = 2;

const MIN_MEANINGFUL_CHARACTERS = 4;
const MIN_CONFIDENCE_LATIN = 30;
const MIN_CONFIDENCE_OTHER = 25;
const MIN_MEANINGFUL_RATIO = 0.6;

const WORKER_LOAD_TIMEOUT_MS = 60_000;
const RECOGNITION_TIMEOUT_MS = 45_000;
const WORKER_IDLE_TIMEOUT_MS = 5 * 60_000;

/** Languages offered to users. Keys are Tesseract language codes. */
export const SUPPORTED_OCR_LANGUAGES = {
  eng: 'English',
  hin: 'Hindi',
  mar: 'Marathi',
  ben: 'Bengali',
  tam: 'Tamil',
  tel: 'Telugu',
  kan: 'Kannada',
  mal: 'Malayalam',
  guj: 'Gujarati',
  pan: 'Punjabi',
  ori: 'Odia',
  urd: 'Urdu',
  ara: 'Arabic',
  spa: 'Spanish',
  fra: 'French',
  deu: 'German',
  ita: 'Italian',
  por: 'Portuguese',
  rus: 'Russian',
  jpn: 'Japanese',
  kor: 'Korean',
  chi_sim: 'Chinese (Simplified)',
} as const;

export type OCRLanguageCode = keyof typeof SUPPORTED_OCR_LANGUAGES;

const LATIN_LANGUAGES = new Set(['eng', 'spa', 'fra', 'deu', 'ita', 'por']);

// -----------------------------------------------------------------------------
// Types & errors
// -----------------------------------------------------------------------------

type OCRWorker = Worker;

type OCRErrorCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_ENVIRONMENT'
  | 'UNSUPPORTED_LANGUAGE'
  | 'WORKER_TIMEOUT'
  | 'RECOGNITION_TIMEOUT'
  | 'LOW_QUALITY'
  | 'ABORTED';

export class OCRError extends Error {
  readonly code: OCRErrorCode;

  constructor(code: OCRErrorCode, message: string) {
    super(message);
    this.name = 'OCRError';
    this.code = code;
  }
}

interface OCRResult {
  text: string;
  confidence: number;
}

interface WorkerEntry {
  promise: Promise<OCRWorker>;
  queue: Promise<void>;
  busy: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

export interface RunOCROptions {
  signal?: AbortSignal;
}

const workers = new Map<string, WorkerEntry>();

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new OCRError('ABORTED', 'OCR was cancelled.');
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  code: OCRErrorCode,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new OCRError(code, message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// -----------------------------------------------------------------------------
// Input validation
// -----------------------------------------------------------------------------

function validateInput(dataUri: string): void {
  if (typeof dataUri !== 'string' || !dataUri.trim()) {
    throw new OCRError('INVALID_INPUT', 'OCR image is missing.');
  }

  if (dataUri.length > MAX_INPUT_DATA_URI_LENGTH) {
    throw new OCRError(
      'INVALID_INPUT',
      'The image is too large to process in the browser.',
    );
  }

  // Check the prefix only. Running a regex over a multi-MB base64 string
  // can block the main thread.
  if (!/^data:image\/(?:jpeg|jpg|png|webp|bmp|gif);base64,/i.test(dataUri.slice(0, 64))) {
    throw new OCRError('INVALID_INPUT', 'Unsupported image format for OCR.');
  }
}

function normalizeLanguage(language: string | undefined): string {
  const requested = (language ?? DEFAULT_LANGUAGE)
    .split('+')
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);

  const unique = Array.from(new Set(requested));

  if (unique.length === 0) return DEFAULT_LANGUAGE;

  if (unique.length > MAX_COMBINED_LANGUAGES) {
    throw new OCRError(
      'UNSUPPORTED_LANGUAGE',
      `Please select at most ${MAX_COMBINED_LANGUAGES} languages for OCR.`,
    );
  }

  for (const code of unique) {
    if (!(code in SUPPORTED_OCR_LANGUAGES)) {
      throw new OCRError('UNSUPPORTED_LANGUAGE', `Unsupported OCR language: ${code}`);
    }
  }

  return unique.join('+');
}

function minConfidenceFor(language: string): number {
  const allLatin = language.split('+').every((code) => LATIN_LANGUAGES.has(code));
  return allLatin ? MIN_CONFIDENCE_LATIN : MIN_CONFIDENCE_OTHER;
}

// -----------------------------------------------------------------------------
// Image preparation
// -----------------------------------------------------------------------------

function loadImage(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new OCRError('INVALID_INPUT', 'The image has invalid dimensions.'));
        return;
      }
      resolve(image);
    };

    image.onerror = () =>
      reject(new OCRError('INVALID_INPUT', 'Could not decode the image for OCR.'));

    image.src = dataUri;
  });
}

/**
 * Returns the original data URI when no resize is needed (no re-encode, no
 * quality loss). Otherwise returns a downscaled canvas. Never upscales.
 */
function prepareImage(
  image: HTMLImageElement,
  originalDataUri: string,
): string | HTMLCanvasElement {
  const largest = Math.max(image.naturalWidth, image.naturalHeight);

  if (largest <= MAX_IMAGE_DIMENSION) {
    return originalDataUri;
  }

  const scale = MAX_IMAGE_DIMENSION / largest;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new OCRError('UNSUPPORTED_ENVIRONMENT', 'Could not create OCR canvas.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  return canvas;
}

function releaseImage(prepared: string | HTMLCanvasElement): void {
  if (typeof prepared !== 'string') {
    prepared.width = 0;
    prepared.height = 0;
  }
}

// -----------------------------------------------------------------------------
// Text cleanup & quality checks
// -----------------------------------------------------------------------------

function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function meaningfulCount(text: string): number {
  return (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
}

/** Catches junk output that can still carry a decent confidence score. */
function looksLikeGarbage(text: string): boolean {
  const compact = text.replace(/\s/g, '');
  if (!compact) return true;

  if (meaningfulCount(text) / compact.length < MIN_MEANINGFUL_RATIO) {
    return true;
  }

  const tokens = text.split(/\s+/).filter(Boolean);

  if (tokens.length >= 6) {
    const singleLetters = tokens.filter((token) => /^\p{L}$/u.test(token)).length;
    if (singleLetters / tokens.length > 0.6) return true;
  }

  if (text.includes('\uFFFD')) return true;

  return false;
}

function validateResult(result: OCRResult, language: string): string {
  const text = cleanText(result.text);
  const meaningful = meaningfulCount(text);

  const confidentEnough = result.confidence >= minConfidenceFor(language);
  const substantial = meaningful >= 8; // clear text can pass despite noisy average

  if (
    meaningful < MIN_MEANINGFUL_CHARACTERS ||
    looksLikeGarbage(text) ||
    !(confidentEnough || substantial)
  ) {
    throw new OCRError('LOW_QUALITY', 'Could not read this image clearly. Check that the selected language matches the text, move closer, and improve focus and lighting.');
  }
  return text;
}

// -----------------------------------------------------------------------------
// Worker management
// -----------------------------------------------------------------------------

async function createOCRWorker(language: string): Promise<OCRWorker> {
  const langPath = process.env.NEXT_PUBLIC_TESSDATA_PATH?.trim();

  const worker = await createWorker(language, 1, {
    ...(langPath ? { langPath } : {}),
    logger: () => {
      // Keep the production console quiet.
    },
  });

  try {
    await worker.setParameters({ preserve_interword_spaces: '1' });
  } catch {
    // Non-critical; some traineddata builds reject parameters.
  }

  return worker;
}

function disposeWorker(key: string): void {
  const entry = workers.get(key);
  if (!entry) return;

  workers.delete(key);

  if (entry.idleTimer) clearTimeout(entry.idleTimer);

  entry.promise
    .then((worker) => worker.terminate())
    .catch(() => {
      // Worker never started or is already gone.
    });
}

function scheduleIdleTermination(key: string): void {
  const entry = workers.get(key);
  if (!entry) return;

  if (entry.idleTimer) clearTimeout(entry.idleTimer);

  entry.idleTimer = setTimeout(() => {
    const current = workers.get(key);
    if (!current) return;

    if (current.busy > 0) {
      scheduleIdleTermination(key);
      return;
    }

    disposeWorker(key);
  }, WORKER_IDLE_TIMEOUT_MS);
}

function getEntry(key: string): WorkerEntry {
  const existing = workers.get(key);
  if (existing) return existing;

  const entry: WorkerEntry = {
    promise: createOCRWorker(key),
    queue: Promise.resolve(),
    busy: 0,
    idleTimer: null,
  };

  // If creation fails, forget the entry so the next scan retries cleanly.
  entry.promise.catch(() => {
    if (workers.get(key) === entry) workers.delete(key);
  });

  workers.set(key, entry);
  scheduleIdleTermination(key);

  return entry;
}

/** Runs jobs on one worker strictly one at a time. */
function runExclusive<T>(entry: WorkerEntry, task: () => Promise<T>): Promise<T> {
  const run = entry.queue.then(task);
  entry.queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
interface OCRLine {
  text: string;
  confidence: number;
}

const MIN_LINE_CONFIDENCE = 60;
const MIN_LINE_MEANINGFUL_RATIO = 0.7;

function extractLines(data: unknown): OCRLine[] {
  const d = data as {
    lines?: OCRLine[];
    blocks?: { paragraphs?: { lines?: OCRLine[] }[] }[];
  };

  if (Array.isArray(d.lines) && d.lines.length) return d.lines;

  return (d.blocks ?? []).flatMap((block) =>
    (block.paragraphs ?? []).flatMap((paragraph) => paragraph.lines ?? []),
  );
}

function keepLine(line: OCRLine): boolean {
  const text = (line.text ?? '').trim();
  if (!text || line.confidence < MIN_LINE_CONFIDENCE) return false;

  const compact = text.replace(/\s/g, '');
  if (!compact) return false;

  return meaningfulCount(text) / compact.length >= MIN_LINE_MEANINGFUL_RATIO;
}

async function recognize(
  key: string,
  entry: WorkerEntry,
  worker: OCRWorker,
  image: string | HTMLCanvasElement,
): Promise<OCRResult> {
  return runExclusive(entry, async () => {
    entry.busy += 1;

    try {
      const recognition = worker.recognize(image as Parameters<OCRWorker['recognize']>[0]);
      // Avoid unhandled rejections if we terminate the worker on timeout.
      recognition.catch(() => undefined);

      const result = await withTimeout(
        recognition,
        RECOGNITION_TIMEOUT_MS,
        'RECOGNITION_TIMEOUT',
        'Reading the image took too long. Please try again.',
      );

      const lines = extractLines(result.data);

      if (lines.length > 0) {
        const kept = lines.filter(keepLine);

        if (process.env.NODE_ENV === 'development') {
          console.info('[Client OCR] Lines', {
            total: lines.length,
            kept: kept.length,
            dropped: lines
              .filter((line) => !keepLine(line))
              .map((line) => ({
                confidence: Math.round(line.confidence),
                sample: line.text.trim().slice(0, 30),
              })),
          });
        }

        return {
          text: cleanText(kept.map((line) => line.text.trim()).join('\n')),
          confidence: kept.length
            ? kept.reduce((sum, line) => sum + line.confidence, 0) / kept.length
            : 0,
        };
      }

      // Fallback when this tesseract.js build exposes no line data.
      return {
        text: cleanText(result.data.text ?? ''),
        confidence:
          typeof result.data.confidence === 'number' ? result.data.confidence : 0,
      };
    } catch (error: unknown) {
      // A hung worker must not poison later scans.
      if (error instanceof OCRError && error.code === 'RECOGNITION_TIMEOUT') {
        disposeWorker(key);
      }
      throw error;
    } finally {
      entry.busy -= 1;
      scheduleIdleTermination(key);
    }
  });
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/** Warm the worker while the camera screen opens to hide cold-start cost. */
export function preloadOCR(language: string = DEFAULT_LANGUAGE): void {
  if (!isBrowser()) return;

  try {
    const key = normalizeLanguage(language);
    void getEntry(key).promise.catch((error: unknown) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Client OCR] Preload failed; will retry on scan.', error);
      }
    });
  } catch (error: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Client OCR] Preload skipped:', error);
    }
  }
}

/** Terminate every worker and free memory (e.g. when leaving the feature). */
export function terminateOCR(): void {
  for (const key of Array.from(workers.keys())) {
    disposeWorker(key);
  }
}

export async function runClientOCR(
  photoDataUri: string,
  language: string = DEFAULT_LANGUAGE,
  options: RunOCROptions = {},
): Promise<string> {
  const startedAt = now();
  const { signal } = options;
  let prepared: string | HTMLCanvasElement | null = null;

  try {
    validateInput(photoDataUri);

    if (!isBrowser()) {
      throw new OCRError(
        'UNSUPPORTED_ENVIRONMENT',
        'Browser OCR is only available in the browser.',
      );
    }

    const normalizedLanguage = normalizeLanguage(language);

    throwIfAborted(signal);

    const image = await loadImage(photoDataUri);
    prepared = prepareImage(image, photoDataUri);

    throwIfAborted(signal);

    const workerWaitStartedAt = now();
    const entry = getEntry(normalizedLanguage);
    const worker = await withTimeout(
      entry.promise,
      WORKER_LOAD_TIMEOUT_MS,
      'WORKER_TIMEOUT',
      'The text reader is taking too long to load. Check your connection and try again.',
    );
    const workerReadyAt = now();

    throwIfAborted(signal);

    const recognitionStartedAt = now();
    const result = await recognize(normalizedLanguage, entry, worker, prepared);
    const recognitionEndedAt = now();

    throwIfAborted(signal);

    const finalText = validateResult(result, normalizedLanguage);

    if (process.env.NODE_ENV === 'development') {
      console.info('[Client OCR] Timing', {
        language: normalizedLanguage,
        imageWidth: image.naturalWidth,
        imageHeight: image.naturalHeight,
        resized: typeof prepared !== 'string',
        workerWaitMs: Math.round(workerReadyAt - workerWaitStartedAt),
        recognitionMs: Math.round(recognitionEndedAt - recognitionStartedAt),
        totalMs: Math.round(now() - startedAt),
        confidence: Math.round(result.confidence),
        extractedCharacters: finalText.length,
      });
    }

    return finalText;
  } catch (error: unknown) {
    const isAbort = error instanceof OCRError && error.code === 'ABORTED';
    if (!isAbort) {
      console.error('[Client OCR] Pipeline failed:', error);
    }
    throw error;
  } finally {
    if (prepared) releaseImage(prepared);
  }
}