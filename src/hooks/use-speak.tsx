'use client';

import * as React from 'react';
import { useToast } from './use-toast';
import { handleTextToSpeech } from '@/app/actions';

interface SpeakProps {
  text: string;
  lang: string;
}

interface UseSpeakReturn {
  speak: (props: SpeakProps) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const MAX_SPEECH_LENGTH = 8_000;
// Must match MAX_SERVER_TTS_CHARS in text-to-speech.ts. Longer text is read
// by the browser only, so we don't waste a server round trip on it.
const MAX_SERVER_TTS_CHARS = 1_500;
const AUDIO_START_TIMEOUT_MS = 15_000;
const VOICE_WAIT_MS = 1_000;
// Chrome stops long utterances after ~15 s, so speech is queued in chunks.
const MAX_CHUNK_LENGTH = 220;
const DEFAULT_LANGUAGE = 'en-US';

// Default: use the browser's own voice when one exists (instant and free) and
// call the server only when there is none. Set NEXT_PUBLIC_TTS_PREFER_SERVER=1
// to prefer your TTS provider's voice quality.
const PREFER_SERVER = process.env.NEXT_PUBLIC_TTS_PREFER_SERVER === '1';

type PlaybackOutcome = 'success' | 'failed' | 'cancelled';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function hasBrowserSpeech(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
}

/** en -> en, en-US -> en-us, EN_us -> en-us */
function normalizeLanguageCode(language: string): string {
  return language.trim().replace(/_/g, '-').toLowerCase();
}

/** Exact locale match first, then same base language. Never falls back to an unrelated voice. */
function findBestVoice(
  voices: SpeechSynthesisVoice[],
  requestedLanguage: string,
): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;

  const requested = normalizeLanguageCode(requestedLanguage);
  const requestedBase = requested.split('-')[0];

  return (
    voices.find((voice) => normalizeLanguageCode(voice.lang) === requested) ??
    voices.find((voice) => normalizeLanguageCode(voice.lang).split('-')[0] === requestedBase)
  );
}

/** Android and some desktop browsers fill the voice list asynchronously. */
function waitForVoices(synthesis: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const existing = synthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const done = () => {
      synthesis.removeEventListener('voiceschanged', done);
      clearTimeout(timer);
      resolve(synthesis.getVoices());
    };

    const timer = setTimeout(done, VOICE_WAIT_MS);
    synthesis.addEventListener('voiceschanged', done);
  });
}

/** Splits text at sentence boundaries (including the Devanagari danda). */
function splitIntoChunks(text: string, maxLength = MAX_CHUNK_LENGTH): string[] {
  const sentences = text.match(/[^.!?।॥。！？\n]+[.!?।॥。！？]*\s*|\n+/g) ?? [text];
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = '';
  };

  for (const sentence of sentences) {
    if (sentence.length > maxLength) {
      flush();

      let start = 0;
      while (start < sentence.length) {
        let end = Math.min(start + maxLength, sentence.length);

        if (end < sentence.length) {
          const space = sentence.lastIndexOf(' ', end);
          if (space > start + maxLength / 2) end = space;
        }

        const piece = sentence.slice(start, end).trim();
        if (piece) chunks.push(piece);
        start = end;
      }
      continue;
    }

    if (current.length + sentence.length > maxLength) flush();
    current += sentence;
  }

  flush();
  return chunks;
}

/** Converts SpeechSynthesis error codes to user-friendly messages. Empty = ignore. */
function getSpeechErrorMessage(error: SpeechSynthesisErrorEvent): string {
  switch (error.error) {
    case 'not-allowed':
      return 'Speech playback was blocked by your browser. Please allow audio and try again.';
    case 'language-unavailable':
    case 'voice-unavailable':
      return 'A voice for this language is not available in your browser.';
    case 'synthesis-unavailable':
      return 'Speech synthesis is temporarily unavailable.';
    case 'network':
      return 'The browser speech service could not be reached.';
    case 'audio-busy':
      return 'Audio playback is currently busy. Please try again.';
    case 'audio-hardware':
      return 'Your audio device could not play the speech.';
    case 'canceled':
    case 'interrupted':
      return '';
    default:
      return 'An unexpected error occurred during speech playback.';
  }
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

export const useSpeak = (): UseSpeakReturn => {
  const { toast } = useToast();

  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const cleanupAudioRef = React.useRef<(() => void) | null>(null);
  const activeUtteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);
  const lastBrowserErrorRef = React.useRef('');
  const mountedRef = React.useRef(true);

  // Each playback request gets an id so older async work can't touch newer state.
  const requestIdRef = React.useRef(0);

  const isCurrent = React.useCallback(
    (requestId: number) => mountedRef.current && requestId === requestIdRef.current,
    [],
  );

  /* ---------------------------- Stop helpers ----------------------------- */

  const stopAudio = React.useCallback(() => {
    const audio = audioRef.current;

    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute('src');
        audio.load();
      } catch {
        // Audio cleanup must never crash the app.
      }
      audioRef.current = null;
    }

    if (cleanupAudioRef.current) {
      cleanupAudioRef.current();
      cleanupAudioRef.current = null;
    }
  }, []);

  const stopBrowserSpeech = React.useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore.
    }
  }, []);

  const stop = React.useCallback(() => {
    requestIdRef.current += 1;
    stopAudio();
    stopBrowserSpeech();

    if (mountedRef.current) setIsSpeaking(false);
  }, [stopAudio, stopBrowserSpeech]);

  /* --------------------------- Server audio ------------------------------ */

  /** Resolves true once playback has started. */
  const playServerAudio = React.useCallback(
    async (audioDataUri: string, requestId: number): Promise<boolean> => {
      if (typeof audioDataUri !== 'string' || !audioDataUri.trim() || !isCurrent(requestId)) {
        return false;
      }

      stopAudio();
      stopBrowserSpeech();

      if (!isCurrent(requestId)) return false;

      let audio: HTMLAudioElement;
      try {
        audio = new Audio();
      } catch {
        return false;
      }

      audio.preload = 'auto';
      audioRef.current = audio;

      let settled = false;
      let startupTimeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (startupTimeoutId !== null) {
          clearTimeout(startupTimeoutId);
          startupTimeoutId = null;
        }
        audio.onended = null;
        audio.onerror = null;
        audio.onabort = null;
      };

      const release = () => {
        if (audioRef.current === audio) audioRef.current = null;
        if (cleanupAudioRef.current === cleanup) cleanupAudioRef.current = null;
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        release();

        if (isCurrent(requestId)) setIsSpeaking(false);
      };

      const fail = (): false => {
        if (!settled) {
          settled = true;
          cleanup();

          try {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
          } catch {
            // Must not block the browser fallback.
          }

          release();
        }
        return false;
      };

      cleanupAudioRef.current = cleanup;
      audio.onended = finish;
      audio.onerror = () => {
        fail();
      };
      audio.onabort = () => {
        fail();
      };

      try {
        audio.src = audioDataUri;

        // Bound startup so a stuck play() can't block the fallback.
        await Promise.race([
          audio.play(),
          new Promise<never>((_, reject) => {
            startupTimeoutId = setTimeout(
              () => reject(new Error('Audio playback startup timed out.')),
              AUDIO_START_TIMEOUT_MS,
            );
          }),
        ]);

        if (!isCurrent(requestId)) return fail();

        if (startupTimeoutId !== null) {
          clearTimeout(startupTimeoutId);
          startupTimeoutId = null;
        }

        return true;
      } catch {
        return fail();
      }
    },
    [isCurrent, stopAudio, stopBrowserSpeech],
  );

  const speakWithServer = React.useCallback(
    async (text: string, language: string, requestId: number): Promise<PlaybackOutcome> => {
      try {
        const result = await handleTextToSpeech({ text, languageCode: language });

        if (!isCurrent(requestId)) return 'cancelled';

        if (result.success && result.audioDataUri) {
          return (await playServerAudio(result.audioDataUri, requestId)) ? 'success' : 'failed';
        }

        return 'failed';
      } catch (error: unknown) {
        console.error('[useSpeak] Server TTS failed:', error);
        return isCurrent(requestId) ? 'failed' : 'cancelled';
      }
    },
    [isCurrent, playServerAudio],
  );

  /* ---------------------------- Browser speech --------------------------- */

  const speakWithBrowser = React.useCallback(
    (
      text: string,
      language: string,
      requestId: number,
      voice: SpeechSynthesisVoice | undefined,
    ): Promise<PlaybackOutcome> => {
      return new Promise((resolve) => {
        if (!hasBrowserSpeech() || !isCurrent(requestId)) {
          resolve(isCurrent(requestId) ? 'failed' : 'cancelled');
          return;
        }

        const chunks = splitIntoChunks(text);
        if (chunks.length === 0) {
          resolve('failed');
          return;
        }

        stopAudio();

        const synthesis = window.speechSynthesis;

        try {
          synthesis.cancel();
        } catch {
          // Ignore.
        }

        let index = 0;
        let settled = false;

        const finish = (outcome: PlaybackOutcome) => {
          if (settled) return;
          settled = true;
          activeUtteranceRef.current = null;

          if (isCurrent(requestId)) setIsSpeaking(false);
          resolve(outcome);
        };

        const speakNext = () => {
          if (settled) return;

          if (!isCurrent(requestId)) {
            finish('cancelled');
            return;
          }

          if (index >= chunks.length) {
            finish('success');
            return;
          }

          const utterance = new SpeechSynthesisUtterance(chunks[index]);
          utterance.lang = language;
          utterance.rate = 1;
          utterance.pitch = 1;
          utterance.volume = 1;
          if (voice) utterance.voice = voice;

          utterance.onstart = () => {
            if (isCurrent(requestId)) setIsSpeaking(true);
          };

          utterance.onend = () => {
            index += 1;
            speakNext();
          };

          utterance.onerror = (event) => {
            // "canceled" and "interrupted" are normal when speech is replaced or stopped.
            if (event.error === 'canceled' || event.error === 'interrupted') {
              finish('cancelled');
              return;
            }

            lastBrowserErrorRef.current = getSpeechErrorMessage(event);
            finish('failed');
          };

          // Keep a reference: some browsers garbage-collect utterances mid-speech.
          activeUtteranceRef.current = utterance;

          try {
            synthesis.speak(utterance);
          } catch {
            finish('failed');
          }
        };

        // Chrome can drop speak() called immediately after cancel().
        setTimeout(speakNext, 60);
      });
    },
    [isCurrent, stopAudio],
  );

  /* ------------------------------- Public API ---------------------------- */

  const speak = React.useCallback(
    async ({ text, lang }: SpeakProps): Promise<void> => {
      const normalizedText = text.trim();
      const normalizedLanguage = lang.trim().replace(/_/g, '-') || DEFAULT_LANGUAGE;

      if (!normalizedText) return;

      if (normalizedText.length > MAX_SPEECH_LENGTH) {
        toast({
          variant: 'destructive',
          title: 'Text Too Long',
          description: 'Please shorten the text before using text-to-speech.',
        });
        return;
      }

      const requestId = ++requestIdRef.current;

      // Repeated clicks behave predictably: always stop previous playback first.
      stopAudio();
      stopBrowserSpeech();
      lastBrowserErrorRef.current = '';

      if (mountedRef.current) setIsSpeaking(true);

      try {
        const browserSupported = hasBrowserSpeech();
        let voices: SpeechSynthesisVoice[] = [];

        if (browserSupported) {
          voices = await waitForVoices(window.speechSynthesis);
          if (!isCurrent(requestId)) return;
        }

        const voice = findBestVoice(voices, normalizedLanguage);

        // Use the browser only with a matching voice. Reading Hindi text with an
        // English voice sounds like noise. (An empty voice list is allowed: some
        // browsers synthesize by language without listing voices.)
        const browserUsable = browserSupported && (voices.length === 0 || voice !== undefined);
        const serverEligible = normalizedText.length <= MAX_SERVER_TTS_CHARS;

        const order: Array<'browser' | 'server'> = [];
        if (browserUsable && !(PREFER_SERVER && serverEligible)) order.push('browser');
        if (serverEligible) order.push('server');
        if (browserUsable && PREFER_SERVER && serverEligible) order.push('browser');

        for (const strategy of order) {
          const outcome =
            strategy === 'browser'
              ? await speakWithBrowser(normalizedText, normalizedLanguage, requestId, voice)
              : await speakWithServer(normalizedText, normalizedLanguage, requestId);

          if (outcome === 'success' || outcome === 'cancelled') return;
        }

        if (isCurrent(requestId)) {
          setIsSpeaking(false);

          toast({
            variant: 'destructive',
            title: 'Text-to-Speech Unavailable',
            description:
              lastBrowserErrorRef.current ||
              'No voice is available for this language on your device. Try another language or device.',
          });
        }
      } catch (error: unknown) {
        console.error('[useSpeak] Unexpected error:', error);

        if (isCurrent(requestId)) {
          setIsSpeaking(false);

          toast({
            variant: 'destructive',
            title: 'Text-to-Speech Error',
            description: 'Could not play speech. Please try again.',
          });
        }
      }
    },
    [isCurrent, speakWithBrowser, speakWithServer, stopAudio, stopBrowserSpeech, toast],
  );

  /* ------------------------------- Cleanup ------------------------------- */

  React.useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;

      stopAudio();

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore cleanup failures.
        }
      }
    };
  }, [stopAudio]);

  return {
    speak,
    stop,
    isSpeaking,
    // Server TTS keeps the hook usable even when browser speech is absent.
    isSupported: true,
  };
};