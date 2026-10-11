'use client';

import * as React from 'react';

import { useToast } from '@/hooks/use-toast';

// The Speech Recognition API is missing from TypeScript's DOM typings.
// Only the parts used here are declared.
interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly [index: number]: SpeechRecognitionAlternativeLike;
  readonly isFinal: boolean;
  readonly length: number;
}

interface SpeechRecognitionResultListLike {
  readonly [index: number]: SpeechRecognitionResultLike;
  readonly length: number;
}

interface SpeechRecognitionEventLike extends Event {
  readonly results: SpeechRecognitionResultListLike;
  readonly resultIndex: number;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

// An intersection (not `extends Window`) avoids conflicts with DOM typings.
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;

  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function getErrorDescription(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Please allow microphone permission in your browser settings.';
    case 'audio-capture':
      return 'No working microphone was detected. Please check your microphone and try again.';
    case 'network':
      return 'Speech recognition needs a network connection. Please check your connection and try again.';
    case 'language-not-supported':
      return 'Speech recognition is not available for this language in your current browser.';
    default:
      return 'Speech recognition failed. Please try again.';
  }
}

interface UseSpeechRecognitionOptions {
  /** Called with the final transcript. The latest callback is always used. */
  onResult: (text: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  /** Starts listening in the given BCP-47 language. Returns false if it could not start. */
  start: (lang: string) => boolean;
  /** Stops listening and still delivers any result already captured. */
  stop: () => void;
  /** Cancels immediately and discards any result. */
  abort: () => void;
}

export function useSpeechRecognition({
  onResult,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const { toast } = useToast();

  const [isSupported, setIsSupported] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);

  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);

  // Keep the latest callbacks without recreating the recognition session.
  const onResultRef = React.useRef(onResult);
  const toastRef = React.useRef(toast);

  React.useEffect(() => {
    onResultRef.current = onResult;
    toastRef.current = toast;
  });

  const detach = React.useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;

    try {
      recognition.abort();
    } catch {
      // Recognition may already have ended.
    }

    recognitionRef.current = null;
  }, []);

  // Support is detected after mount so server and client markup match.
  React.useEffect(() => {
    setIsSupported(getRecognitionConstructor() !== null);

    return () => {
      detach();
    };
  }, [detach]);

  const start = React.useCallback(
    (lang: string): boolean => {
      const RecognitionClass = getRecognitionConstructor();

      if (!RecognitionClass) {
        toastRef.current({
          variant: 'destructive',
          title: 'Speech recognition unavailable',
          description: 'Your current browser does not support speech recognition.',
        });
        return false;
      }

      detach();

      const recognition = new RecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = lang;

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event) => {
        const text = event.results[event.resultIndex]?.[0]?.transcript?.trim();
        if (text) onResultRef.current(text);
      };

      recognition.onerror = (event) => {
        setIsListening(false);

        // "no-speech" is normal when the user stays silent.
        if (event.error === 'no-speech' || event.error === 'aborted') return;

        console.error('[SpeechRecognition] Error:', event.error, event.message);

        toastRef.current({
          variant: 'destructive',
          title: 'Speech Error',
          description: getErrorDescription(event.error),
        });
      };

      recognition.onend = () => {
        setIsListening(false);
        if (recognitionRef.current === recognition) recognitionRef.current = null;
      };

      recognitionRef.current = recognition;

      try {
        // start() requests microphone permission itself. A separate getUserMedia
        // stream is unnecessary and breaks recognition on some Android browsers.
        recognition.start();
        return true;
      } catch (error: unknown) {
        console.error('[SpeechRecognition] Could not start.', error);

        recognitionRef.current = null;
        setIsListening(false);

        toastRef.current({
          variant: 'destructive',
          title: 'Speech Error',
          description: 'Could not start speech recognition. Please try again.',
        });
        return false;
      }
    },
    [detach],
  );

  const stop = React.useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped.
    }
  }, []);

  const abort = React.useCallback(() => {
    detach();
    setIsListening(false);
  }, [detach]);

  return { isSupported, isListening, start, stop, abort };
}