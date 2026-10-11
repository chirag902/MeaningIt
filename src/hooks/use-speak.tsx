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

const MAX_SPEECH_LENGTH = 8_000;
const AUDIO_LOAD_TIMEOUT_MS = 15_000;

const DEFAULT_LANGUAGE = 'en-US';

type SpeechSynthesisVoiceWithLanguage = SpeechSynthesisVoice & {
  lang: string;
};

/**
 * Normalizes language codes such as:
 *   en      -> en
 *   en-US   -> en-us
 *   EN_us   -> en-us
 */
function normalizeLanguageCode(language: string): string {
  return language.trim().replace('_', '-').toLowerCase();
}

/**
 * Finds the best browser voice for a requested BCP-47 language.
 *
 * Priority:
 * 1. Exact locale match       en-US === en-US
 * 2. Same base language       en-US ~= en-GB
 * 3. Any available voice
 */
function findBestVoice(
  voices: SpeechSynthesisVoice[],
  requestedLanguage: string,
): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) {
    return undefined;
  }

  const normalizedRequested = normalizeLanguageCode(requestedLanguage);
  const requestedBase = normalizedRequested.split('-')[0];

  const exactMatch = voices.find(
    (voice) =>
      normalizeLanguageCode(voice.lang) === normalizedRequested,
  );

  if (exactMatch) {
    return exactMatch;
  }

  const baseLanguageMatch = voices.find((voice) => {
    const voiceLanguage = normalizeLanguageCode(voice.lang);
    return voiceLanguage.split('-')[0] === requestedBase;
  });

  return baseLanguageMatch;
}

/**
 * Converts browser SpeechSynthesis error codes into
 * user-friendly messages.
 */
function getSpeechErrorMessage(error: SpeechSynthesisErrorEvent): string {
  switch (error.error) {
    case 'not-allowed':
      return 'Speech playback was blocked by your browser. Please allow audio playback and try again.';

    case 'language-unavailable':
      return 'A voice for this language is not available in your browser.';

    case 'voice-unavailable':
      return 'A suitable voice for this language is not available.';

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

/**
 * Creates a timeout promise used to prevent a stuck Audio element
 * from leaving the hook permanently in the speaking state.
 */


export const useSpeak = (): UseSpeakReturn => {
  const { toast } = useToast();

  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const speechSynthesisRef = React.useRef<SpeechSynthesis | null>(null);

  /**
   * Each playback request receives an ID.
   *
   * This prevents an older asynchronous TTS request from changing
   * the state after a newer request has already started.
   */
  const requestIdRef = React.useRef(0);

  const mountedRef = React.useRef(true);

  /**
   * Browser TTS voices are loaded asynchronously in some browsers.
   * Keeping them in a ref avoids unnecessary component renders.
   */
  const voicesRef = React.useRef<SpeechSynthesisVoice[]>([]);

  /**
   * Prevents duplicate cleanup callbacks from racing with each other.
   */
  const cleanupAudioRef = React.useRef<(() => void) | null>(null);

  const isBrowserSpeechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window;

  const isSupported = isBrowserSpeechSupported || true;
  // Server-side TTS is available through handleTextToSpeech,
  // so the hook itself remains usable even when browser TTS is absent.

  /**
   * Update the cached browser voices.
   */
  const refreshVoices = React.useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      voicesRef.current = [];
      return;
    }

    voicesRef.current = window.speechSynthesis.getVoices();
  }, []);

  /**
   * Stops currently playing server-generated audio.
   */
  const stopAudio = React.useCallback(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
      audio.load();
    } catch {
      // Audio cleanup should never crash the application.
    }

    audioRef.current = null;

    if (cleanupAudioRef.current) {
      cleanupAudioRef.current();
      cleanupAudioRef.current = null;
    }
  }, []);

  /**
   * Stops browser-native speech synthesis.
   */
  const stopBrowserSpeech = React.useCallback(() => {
    if (
      typeof window === 'undefined' ||
      !window.speechSynthesis
    ) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch {
      // Browser speech cleanup should never throw.
    }
  }, []);

  /**
   * Stops every currently active speech mechanism.
   */
  const stop = React.useCallback(() => {
    requestIdRef.current += 1;

    stopAudio();
    stopBrowserSpeech();

    if (mountedRef.current) {
      setIsSpeaking(false);
    }
  }, [stopAudio, stopBrowserSpeech]);

  /**
   * Plays server-generated audio safely.
   */
  
const playServerAudio = React.useCallback(
  async (
    audioDataUri: string,
    requestId: number,
  ): Promise<boolean> => {
    // Validate the input and reject stale requests.
    if (
      typeof audioDataUri !== 'string' ||
      !audioDataUri.trim() ||
      !mountedRef.current ||
      requestId !== requestIdRef.current
    ) {
      return false;
    }

    // Stop any previous playback before starting this request.
    stopAudio();
    stopBrowserSpeech();

    // Recheck after cleanup in case the request is no longer current.
    if (
      !mountedRef.current ||
      requestId !== requestIdRef.current
    ) {
      return false;
    }

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
      audio.onloadeddata = null;
      audio.oncanplaythrough = null;
    };

    const finish = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      if (audioRef.current === audio) {
        audioRef.current = null;
      }

      if (cleanupAudioRef.current === cleanup) {
        cleanupAudioRef.current = null;
      }

      if (
        mountedRef.current &&
        requestId === requestIdRef.current
      ) {
        setIsSpeaking(false);
      }
    };

    const fail = (): false => {
      if (settled) {
        return false;
      }

      settled = true;
      cleanup();

      try {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch {
        // Cleanup must not prevent browser TTS fallback.
      }

      if (audioRef.current === audio) {
        audioRef.current = null;
      }

      if (cleanupAudioRef.current === cleanup) {
        cleanupAudioRef.current = null;
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

      if (
        mountedRef.current &&
        requestId === requestIdRef.current
      ) {
        setIsSpeaking(true);
      }

      // Bound playback startup so a stuck play() cannot block fallback.
      await Promise.race([
        audio.play(),
        new Promise<never>((_, reject) => {
          startupTimeoutId = setTimeout(() => {
            reject(new Error('Audio playback startup timed out.'));
          }, AUDIO_LOAD_TIMEOUT_MS);
        }),
      ]);

      // Do not allow an older request to continue playing.
      if (
        !mountedRef.current ||
        requestId !== requestIdRef.current
      ) {
        fail();
        return false;
      }

      // Playback has started. Keep event handlers active until
      // onended, onerror, onabort, or explicit stop cleanup.
      if (startupTimeoutId !== null) {
        clearTimeout(startupTimeoutId);
        startupTimeoutId = null;
      }

      return true;
    } catch {
      fail();
      return false;
    }
  },
  [stopAudio, stopBrowserSpeech],
);

  


     
  /**
   * Browser-native TTS fallback.
   */
  const speakWithBrowser = React.useCallback(
    (
      text: string,
      language: string,
      requestId: number,
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        if (
          typeof window === 'undefined' ||
          !window.speechSynthesis ||
          typeof window.SpeechSynthesisUtterance === 'undefined'
        ) {
          resolve(false);
          return;
        }

        if (
          !mountedRef.current ||
          requestId !== requestIdRef.current
        ) {
          resolve(false);
          return;
        }

        stopAudio();

        const synthesis = window.speechSynthesis;
        speechSynthesisRef.current = synthesis;

        try {
          synthesis.cancel();
        } catch {
          // Ignore cancellation errors.
        }

        const utterance = new SpeechSynthesisUtterance(text);

        utterance.lang = language || DEFAULT_LANGUAGE;

        /**
         * Slightly conservative production defaults.
         * They sound natural for a translator while remaining clear.
         */
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        const voices =
          voicesRef.current.length > 0
            ? voicesRef.current
            : synthesis.getVoices();

        voicesRef.current = voices;

        const voice = findBestVoice(voices, utterance.lang);

        if (voice) {
          utterance.voice = voice;
        }

        let settled = false;

        const finish = (success: boolean) => {
          if (settled) {
            return;
          }

          settled = true;

          if (
            mountedRef.current &&
            requestId === requestIdRef.current
          ) {
            setIsSpeaking(false);
          }

          resolve(success);
        };

        utterance.onstart = () => {
          if (
            mountedRef.current &&
            requestId === requestIdRef.current
          ) {
            setIsSpeaking(true);
          }
        };

        utterance.onend = () => {
          finish(true);
        };

        utterance.onerror = (event) => {
          const message = getSpeechErrorMessage(event);

          /**
           * "canceled" and "interrupted" are normal control-flow
           * events when another speech request replaces the current one.
           */
          if (
            message &&
            mountedRef.current &&
            requestId === requestIdRef.current
          ) {
            toast({
              variant: 'destructive',
              title: 'Speech Playback',
              description: message,
            });
          }

          finish(false);
        };

        try {
          synthesis.speak(utterance);
        } catch {
          finish(false);
        }
      });
    },
    [stopAudio, toast],
  );

  /**
   * Main public speech function.
   *
   * Strategy:
   * 1. Validate text.
   * 2. Stop previous speech.
   * 3. Request server-side TTS.
   * 4. Play server audio when available.
   * 5. Automatically fall back to browser TTS.
   * 6. Show a useful error only when both paths fail.
   */
  const speak = React.useCallback(
    async ({ text, lang }: SpeakProps): Promise<void> => {
      const normalizedText = text.trim();
      const normalizedLanguage =
        lang.trim() || DEFAULT_LANGUAGE;

      if (!normalizedText) {
        return;
      }

      if (normalizedText.length > MAX_SPEECH_LENGTH) {
        toast({
          variant: 'destructive',
          title: 'Text Too Long',
          description:
            'Please shorten the text before using text-to-speech.',
        });
        return;
      }

      const requestId = ++requestIdRef.current;

      /**
       * Always stop the previous playback first.
       * This makes repeated clicks behave predictably.
       */
      stopAudio();
      stopBrowserSpeech();

      if (mountedRef.current) {
        setIsSpeaking(true);
      }

      try {
        /**
         * Primary path: server-generated TTS.
         */
        const result = await handleTextToSpeech({
          text: normalizedText,
          languageCode: normalizedLanguage,
        });

        /**
         * Ignore a stale server response.
         */
        if (
          !mountedRef.current ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        if (result.success && result.audioDataUri) {
          const played = await playServerAudio(
            result.audioDataUri,
            requestId,
          );

          if (played) {
            return;
          }
        }

        /**
         * Fallback path: browser SpeechSynthesis.
         */
        const browserSpeechStarted = await speakWithBrowser(
          normalizedText,
          normalizedLanguage,
          requestId,
        );

        if (browserSpeechStarted) {
          return;
        }

        /**
         * Both TTS strategies failed.
         */
        if (
          mountedRef.current &&
          requestId === requestIdRef.current
        ) {
          setIsSpeaking(false);

          toast({
            variant: 'destructive',
            title: 'Text-to-Speech Unavailable',
            description:
              'Could not generate or play speech for this language. Please try another language or try again.',
          });
        }
      } catch (error: unknown) {
        /**
         * Ignore stale requests.
         */
        if (
          !mountedRef.current ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        /**
         * Even if the server action throws, try the browser fallback.
         */
        try {
          const browserSpeechStarted =
            await speakWithBrowser(
              normalizedText,
              normalizedLanguage,
              requestId,
            );

          if (browserSpeechStarted) {
            return;
          }
        } catch {
          // Continue to the final user-facing error.
        }

        if (mountedRef.current) {
          setIsSpeaking(false);

          const message =
            error instanceof Error && error.message.trim()
              ? error.message
              : 'The text-to-speech service failed unexpectedly.';

          toast({
            variant: 'destructive',
            title: 'TTS Error',
            description: message,
          });
        }
      }
    },
    [
      playServerAudio,
      speakWithBrowser,
      stopAudio,
      stopBrowserSpeech,
      toast,
    ],
  );

  /**
   * Load browser voices.
   *
   * Some browsers populate getVoices() asynchronously.
   */
  React.useEffect(() => {
    mountedRef.current = true;

    if (
      typeof window === 'undefined' ||
      !window.speechSynthesis
    ) {
      return;
    }

    const synthesis = window.speechSynthesis;
    speechSynthesisRef.current = synthesis;

    const handleVoicesChanged = () => {
      voicesRef.current = synthesis.getVoices();
    };

    handleVoicesChanged();

    synthesis.addEventListener(
      'voiceschanged',
      handleVoicesChanged,
    );

    return () => {
      synthesis.removeEventListener(
        'voiceschanged',
        handleVoicesChanged,
      );
    };
  }, []);

  /**
   * Global cleanup.
   */
  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;

      stopAudio();

      if (
        typeof window !== 'undefined' &&
        window.speechSynthesis
      ) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore cleanup failures.
        }
      }

      speechSynthesisRef.current = null;
    };
  }, [stopAudio]);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
  };
};