'use client';

import * as React from 'react';
import {
  ArrowRightLeft,
  Copy,
  Loader2,
  Mic,
  Volume2,
  Info,
  Lightbulb,
  Zap,
  Shield,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { languages } from '@/lib/languages';
import { handleTranslation } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { VoiceVisualizer } from './voice-visualizer';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ImageTranslator } from './image-translator';
import { LiveTranslator } from './live-translator';
import { ChatbotTutor } from './chatbot-tutor';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useGamification } from '@/hooks/use-gamification';
import { GamificationProfile } from './gamification-profile';
import { useSpeak } from '@/hooks/use-speak';

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
  onresult:
    | ((event: SpeechRecognitionEventLike) => void)
    | null;
  onerror:
    | ((event: SpeechRecognitionErrorEventLike) => void)
    | null;

  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const MAX_SOURCE_TEXT_LENGTH = 5_000;
const TRANSLATION_DEBOUNCE_MS = 600;

export function Translator() {
  const [sourceLang, setSourceLang] =
    React.useState('auto');

  const [targetLang, setTargetLang] =
    React.useState('es-ES');

  const [sourceText, setSourceText] =
    React.useState('');

  const [translatedText, setTranslatedText] =
    React.useState('');

  const [detectedLangName, setDetectedLangName] =
    React.useState<string | null>(null);

  const [isTranslating, setIsTranslating] =
    React.useState(false);

  const [isListening, setIsListening] =
    React.useState(false);

  const [isSpeechSupported, setIsSpeechSupported] =
    React.useState(false);

  const [toneAnalysis, setToneAnalysis] =
    React.useState<string | null>(null);

  const [toneSuggestions, setToneSuggestions] =
    React.useState<string[]>([]);

  const [isSpeedBoosted, setIsSpeedBoosted] =
    React.useState(false);

  const [isPrivateMode, setIsPrivateMode] =
    React.useState(false);

  const { toast } = useToast();

  const recognitionRef =
    React.useRef<SpeechRecognitionInstance | null>(
      null,
    );

  const audioStreamRef =
    React.useRef<MediaStream | null>(null);

  const debounceRef =
    React.useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const translationRequestIdRef =
    React.useRef(0);

  const mountedRef =
    React.useRef(true);

  const sourceLangRef =
    React.useRef(sourceLang);

  const targetLangRef =
    React.useRef(targetLang);

  const isListeningRef =
    React.useRef(false);

  const isTranslatingRef =
    React.useRef(false);

  const isPrivateModeRef =
    React.useRef(isPrivateMode);

  const {
    logTextTranslation,
    logImageTranslation,
    logTutorMessage,
  } = useGamification();

  const { speak, isSpeaking } = useSpeak();

  /*
   * Keep refs synchronized with current state.
   * These are used by browser event handlers to avoid
   * stale closure problems.
   */
  React.useEffect(() => {
    sourceLangRef.current = sourceLang;
  }, [sourceLang]);

  React.useEffect(() => {
    targetLangRef.current = targetLang;
  }, [targetLang]);

  React.useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  React.useEffect(() => {
    isTranslatingRef.current = isTranslating;
  }, [isTranslating]);

  React.useEffect(() => {
    isPrivateModeRef.current = isPrivateMode;
  }, [isPrivateMode]);

  /*
   * Resolve a language code into the display name used
   * by the server translation action.
   */
  const getLanguageName = React.useCallback(
    (code: string): string => {
      return (
        languages.find(
          (language) => language.code === code,
        )?.name ?? code
      );
    },
    [],
  );

  /*
   * Stop every active microphone track.
   *
   * MediaStream is intentionally kept in a ref instead
   * of React state. It is an imperative browser resource
   * and does not need to trigger component renders.
   */
  const stopAudioStream = React.useCallback(() => {
    const stream = audioStreamRef.current;

    if (!stream) return;

    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (error: unknown) {
        console.debug(
          '[Translator] Failed to stop microphone track.',
          error,
        );
      }
    });

    audioStreamRef.current = null;
  }, []);

  /*
   * Stop speech recognition safely.
   */
  const stopRecognition = React.useCallback(
    (abort = false) => {
      const recognition =
        recognitionRef.current;

      if (recognition) {
        try {
          if (abort) {
            recognition.abort();
          } else {
            recognition.stop();
          }
        } catch (error: unknown) {
          console.debug(
            '[Translator] Speech recognition cleanup.',
            error,
          );
        }
      }

      isListeningRef.current = false;
      setIsListening(false);

      stopAudioStream();
    },
    [stopAudioStream],
  );

  /*
   * Clear translation-related state.
   */
  const clearTranslationResult =
    React.useCallback(() => {
      setTranslatedText('');
      setDetectedLangName(null);
      setToneAnalysis(null);
      setToneSuggestions([]);
    }, []);

  /*
   * Main translation function.
   *
   * Request IDs prevent an older, slower API response from
   * replacing a newer translation.
   */
  const performTranslation =
    React.useCallback(
      async (textToTranslate: string) => {
        const cleanText =
          textToTranslate.trim();

        if (!cleanText) {
          translationRequestIdRef.current += 1;
          clearTranslationResult();
          setIsTranslating(false);
          isTranslatingRef.current = false;
          return;
        }

        if (
          cleanText.length >
          MAX_SOURCE_TEXT_LENGTH
        ) {
          toast({
            variant: 'destructive',
            title: 'Text too long',
            description: `Please keep your text under ${MAX_SOURCE_TEXT_LENGTH.toLocaleString()} characters.`,
          });
          return;
        }

        const requestId =
          ++translationRequestIdRef.current;

        const currentSourceLang =
          sourceLangRef.current;

        const currentTargetLang =
          targetLangRef.current;

        const sourceLanguage =
          currentSourceLang === 'auto'
            ? 'auto'
            : getLanguageName(
                currentSourceLang,
              );

        const targetLanguage =
          getLanguageName(currentTargetLang);

        if (
          !sourceLanguage ||
          !targetLanguage
        ) {
          toast({
            variant: 'destructive',
            title: 'Language Error',
            description:
              'Unable to resolve the selected languages. Please select them again.',
          });
          return;
        }

        setIsTranslating(true);
        isTranslatingRef.current = true;

        try {
          const result =
            await handleTranslation({
              text: cleanText,
              sourceLanguage,
              targetLanguage,
              isSpeedBoosted,
            });

          if (!mountedRef.current) return;

          /*
           * Ignore stale responses.
           */
          if (
            requestId !==
            translationRequestIdRef.current
          ) {
            return;
          }

          if (result.success) {
            const translation =
              result.translation?.trim() ?? '';

            setTranslatedText(translation);

            setDetectedLangName(
              result.detectedLanguageName?.trim() ||
                null,
            );

            setToneAnalysis(
              result.toneAnalysis?.trim() || null,
            );

            setToneSuggestions(
              Array.isArray(result.suggestions)
                ? result.suggestions
                    .filter(
                      (
                        suggestion,
                      ): suggestion is string =>
                        typeof suggestion ===
                        'string' &&
                        suggestion.trim().length >
                          0,
                    )
                    .slice(0, 10)
                : [],
            );

            if (
              !isPrivateModeRef.current &&
              translation
            ) {
              logTextTranslation(
                currentTargetLang,
              );
            }

            return;
          }

          toast({
            variant: 'destructive',
            title: 'Translation Error',
            description:
              result.error ||
              'Could not translate the text. Please try again.',
          });
        } catch (error: unknown) {
          if (!mountedRef.current) return;

          if (
            requestId !==
            translationRequestIdRef.current
          ) {
            return;
          }

          console.error(
            '[Translator] Translation failed.',
            error,
          );

          toast({
            variant: 'destructive',
            title: 'Translation Error',
            description:
              'Something went wrong while translating. Please try again.',
          });
        } finally {
          if (
            mountedRef.current &&
            requestId ===
              translationRequestIdRef.current
          ) {
            setIsTranslating(false);
            isTranslatingRef.current = false;
          }
        }
      },
      [
        clearTranslationResult,
        getLanguageName,
        isSpeedBoosted,
        logTextTranslation,
        toast,
      ],
    );

  /*
   * Debounced automatic translation.
   *
   * This keeps the existing UX where typing automatically
   * triggers translation without requiring a Translate button.
   */
  React.useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const cleanText = sourceText.trim();

    if (!cleanText) {
      translationRequestIdRef.current += 1;
      clearTranslationResult();
      setIsTranslating(false);
      isTranslatingRef.current = false;
      return;
    }

    debounceRef.current =
      setTimeout(() => {
        void performTranslation(
          sourceText,
        );
      }, TRANSLATION_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(
          debounceRef.current,
        );
        debounceRef.current = null;
      }
    };

  }, [
    clearTranslationResult,
    performTranslation,
    sourceText,
    sourceLang,
    targetLang,
  ]);
  

  /*
   * Reset text-specific state when Private Mode changes.
   */
  React.useEffect(() => {
    if (isPrivateMode) {
      toast({
        title: 'Private Mode Enabled',
        description:
          'Translation history and activity will not be saved.',
      });
    }

    setSourceText('');
    clearTranslationResult();

    translationRequestIdRef.current += 1;
  }, [
    clearTranslationResult,
    isPrivateMode,
    toast,
  ]);

  /*
   * Initialize browser SpeechRecognition.
   *
   * This is intentionally typed locally instead of modifying
   * the global Window interface with `any`.
   */
  React.useEffect(() => {
    mountedRef.current = true;

    const speechWindow =
      window as SpeechRecognitionWindow;

    const SpeechRecognitionClass =
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setIsSpeechSupported(false);
      recognitionRef.current = null;

      return;
    }

    const recognition =
      new SpeechRecognitionClass();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang =
      sourceLangRef.current === 'auto'
        ? 'en-US'
        : sourceLangRef.current;

    recognition.onstart = () => {
      if (!mountedRef.current) return;

      isListeningRef.current = true;
      setIsListening(true);
    };

    recognition.onresult = (
      event: SpeechRecognitionEventLike,
    ) => {
      if (!mountedRef.current) return;

      const result =
        event.results[event.resultIndex];

      if (!result) return;

      const alternative = result[0];

      if (!alternative) return;

      const spokenText =
        alternative.transcript.trim();

      if (!spokenText) return;

      if (
        spokenText.length >
        MAX_SOURCE_TEXT_LENGTH
      ) {
        toast({
          variant: 'destructive',
          title: 'Speech too long',
          description:
            'Please speak a shorter sentence and try again.',
        });

        stopRecognition(true);
        return;
      }

      setSourceText(
        spokenText.slice(
          0,
          MAX_SOURCE_TEXT_LENGTH,
        ),
      );
    };

    recognition.onerror = (
      event: SpeechRecognitionErrorEventLike,
    ) => {
      if (!mountedRef.current) return;

      stopAudioStream();

      /*
       * `no-speech` is a normal browser event when the user
       * stops talking. It should not produce an alarming toast.
       */
      if (
        event.error === 'no-speech' ||
        event.error === 'aborted'
      ) {
        isListeningRef.current = false;
        setIsListening(false);
        return;
      }

      let description =
        'Speech recognition failed. Please try again.';

      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          description =
            'Microphone access was blocked. Please allow microphone permission in your browser settings.';
          break;

        case 'audio-capture':
          description =
            'No working microphone was detected. Please check your microphone and try again.';
          break;

        case 'network':
          description =
            'Speech recognition requires a network connection. Please check your connection and try again.';
          break;

        case 'language-not-supported':
          description =
            'Speech recognition is not available for this language in your current browser.';
          break;

        default:
          break;
      }

      console.error(
        '[Translator] Speech recognition error:',
        event.error,
        event.message,
      );

      toast({
        variant: 'destructive',
        title: 'Speech Error',
        description,
      });

      isListeningRef.current = false;
      setIsListening(false);
    };

    recognition.onend = () => {
      if (!mountedRef.current) return;

      isListeningRef.current = false;
      setIsListening(false);

      stopAudioStream();
    };

    recognitionRef.current =
      recognition;

    setIsSpeechSupported(true);

    return () => {
      try {
        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      } catch {
        // Recognition may already have ended.
      }

      if (
        recognitionRef.current ===
        recognition
      ) {
        recognitionRef.current = null;
      }

      stopAudioStream();

      if (mountedRef.current) {
        isListeningRef.current = false;
        setIsListening(false);
      }
    };
  }, [
    stopAudioStream,
    stopRecognition,
    toast,
  ]);

  /*
   * Update recognition language whenever the user changes
   * the source language.
   */
  React.useEffect(() => {
    const recognition =
      recognitionRef.current;

    if (!recognition) return;

    recognition.lang =
      sourceLang === 'auto'
        ? 'en-US'
        : sourceLang;
  }, [sourceLang]);

  /*
   * Stop speech recognition if the source language is changed
   * while actively listening. This avoids browser recognition
   * sessions continuing with the previous language.
   */
 
React.useEffect(() => {
  if (!isListeningRef.current) return;

  stopRecognition(true);
}, [sourceLang, stopRecognition]);


  /*
   * Swap source and target languages.
   *
   * Auto-detect cannot be swapped because it is not a concrete
   * source language.
   */
  const handleSwapLanguages =
    React.useCallback(() => {
      if (sourceLang === 'auto') {
        toast({
          title: "Can't swap from Auto-detect",
          description:
            'Please select a specific source language before swapping.',
        });
        return;
      }

      stopRecognition(true);

      const previousSource =
        sourceLang;

      const previousTarget =
        targetLang;

      const previousTranslation =
        translatedText;

      setSourceLang(previousTarget);
      setTargetLang(previousSource);

      if (previousTranslation.trim()) {
        setSourceText(
          previousTranslation,
        );
      } else {
        setSourceText('');
      }

      setDetectedLangName(null);
      setToneAnalysis(null);
      setToneSuggestions([]);

      /*
       * The normal debounced translation effect will
       * translate the swapped text using the new language pair.
       */
      translationRequestIdRef.current += 1;
    }, [
      sourceLang,
      stopRecognition,
      targetLang,
      toast,
      translatedText,
    ]);

  /*
   * Copy translated text safely.
   */
  const handleCopyToClipboard =
    React.useCallback(async () => {
      const text =
        translatedText.trim();

      if (!text) return;

      try {
        if (
          !navigator.clipboard ||
          !window.isSecureContext
        ) {
          throw new Error(
            'Clipboard API unavailable.',
          );
        }

        await navigator.clipboard.writeText(
          text,
        );

        toast({
          title: 'Copied to clipboard',
          description:
            'The translated text has been copied.',
        });
      } catch (error: unknown) {
        console.error(
          '[Translator] Clipboard copy failed.',
          error,
        );

        toast({
          variant: 'destructive',
          title: 'Copy failed',
          description:
            'Your browser blocked clipboard access. Please copy the text manually.',
        });
      }
    }, [toast, translatedText]);

  /*
   * Start / stop microphone recording.
   */
  const handleListen =
    React.useCallback(async () => {
      const recognition =
        recognitionRef.current;

      if (!recognition) {
        toast({
          variant: 'destructive',
          title:
            'Speech recognition unavailable',
          description:
            'Your current browser does not support speech recognition.',
        });
        return;
      }

      if (isListeningRef.current) {
        stopRecognition(false);
        return;
      }

      if (isTranslatingRef.current) {
        return;
      }

      const currentSourceLang =
        sourceLangRef.current;

      if (currentSourceLang === 'auto') {
        toast({
          variant: 'destructive',
          title: 'Select a language',
          description:
            'Choose a specific source language before using voice input.',
        });
        return;
      }

      stopRecognition(true);

      try {
        if (
          !navigator.mediaDevices?.getUserMedia
        ) {
          throw new Error(
            'Microphone access is not supported by this browser.',
          );
        }

        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: {
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true,
              },
            },
          );

        if (!mountedRef.current) {
          stream
            .getTracks()
            .forEach((track) =>
              track.stop(),
            );
          return;
        }

        audioStreamRef.current = stream;

        recognition.lang =
          currentSourceLang;

        recognition.continuous = false;
        recognition.interimResults = false;

        try {
          recognition.start();
        } catch (error: unknown) {
          stopAudioStream();

          console.error(
            '[Translator] Failed to start speech recognition.',
            error,
          );

          toast({
            variant: 'destructive',
            title: 'Speech Error',
            description:
              'Could not start speech recognition. Please try again.',
          });
        }
      } catch (error: unknown) {
        stopAudioStream();

        console.error(
          '[Translator] Microphone access failed.',
          error,
        );

        const description =
          error instanceof DOMException &&
          error.name === 'NotAllowedError'
            ? 'Microphone access was denied. Please allow microphone permission in your browser settings.'
            : error instanceof DOMException &&
                error.name ===
                  'NotFoundError'
              ? 'No microphone was found. Please connect a microphone and try again.'
              : 'Could not access the microphone. Please check your microphone and browser permissions.';

        toast({
          variant: 'destructive',
          title: 'Microphone Error',
          description,
        });

        isListeningRef.current = false;
        setIsListening(false);
      }
    }, [
      stopAudioStream,
      stopRecognition,
      toast,
    ]);

  /*
   * Clear all text translation state.
   */
  const handleClearText =
    React.useCallback(() => {
      stopRecognition(true);

      translationRequestIdRef.current += 1;

      setSourceText('');
      clearTranslationResult();
      setIsTranslating(false);
      isTranslatingRef.current = false;
    }, [
      clearTranslationResult,
      stopRecognition,
    ]);

  /*
   * Gamification callbacks.
   */
  const onImageTranslateSuccess =
    React.useCallback(() => {
      if (!isPrivateModeRef.current) {
        logImageTranslation();
      }
    }, [logImageTranslation]);

  const onTutorMessageSent =
    React.useCallback(() => {
      if (!isPrivateModeRef.current) {
        logTutorMessage();
      }
    }, [logTutorMessage]);

  /*
   * Cleanup everything when the component unmounts.
   */
  React.useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      translationRequestIdRef.current += 1;

      if (debounceRef.current) {
        clearTimeout(
          debounceRef.current,
        );
        debounceRef.current = null;
      }

      try {
        recognitionRef.current?.abort();
      } catch {
        // Ignore browser cleanup errors.
      }

      recognitionRef.current = null;

      stopAudioStream();
    };
  }, [stopAudioStream]);

  const sourceLanguageName =
    getLanguageName(sourceLang);

  const targetLanguageName =
    getLanguageName(targetLang);

  return (
    <Card className="w-full max-w-4xl border-0 bg-card/60 shadow-2xl backdrop-blur-xl">
      <CardHeader className="border-b p-4">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          {/* Source language */}
          <Select
            value={sourceLang}
            onValueChange={(value) => {
              if (!value) return;

              stopRecognition(true);

              setSourceLang(value);
              setDetectedLangName(null);
            }}
          >
            <SelectTrigger
              className="w-full sm:w-[200px]"
              aria-label="Source language"
            >
              <SelectValue placeholder="Source Language" />
            </SelectTrigger>

            <SelectContent>
              {languages.map((language) => (
                <SelectItem
                  key={language.code}
                  value={language.code}
                >
                  {language.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Swap */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSwapLanguages}
            className="shrink-0"
            disabled={
              sourceLang === 'auto' ||
              isTranslating
            }
            aria-label="Swap source and target languages"
            title="Swap languages"
          >
            <ArrowRightLeft
              className="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
          </Button>

          {/* Target language */}
          <Select
            value={targetLang}
            onValueChange={(value) => {
              if (!value) return;

              setTargetLang(value);
            }}
          >
            <SelectTrigger
              className="w-full sm:w-[200px]"
              aria-label="Target language"
            >
              <SelectValue placeholder="Target Language" />
            </SelectTrigger>

            <SelectContent>
              {languages.map(
                (language) =>
                  language.code !== 'auto' && (
                    <SelectItem
                      key={language.code}
                      value={language.code}
                    >
                      {language.name}
                    </SelectItem>
                  ),
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs
          defaultValue="text"
          className="w-full"
        >
          <TabsList className="mx-auto mt-4 grid h-auto w-full max-w-lg grid-cols-5 rounded-xl bg-muted/60 p-1">
            <TabsTrigger value="text">
              Text
            </TabsTrigger>

            <TabsTrigger value="image">
              Image
            </TabsTrigger>

            <TabsTrigger value="live">
              Live
            </TabsTrigger>

            <TabsTrigger value="tutor">
              Tutor
            </TabsTrigger>

            <TabsTrigger value="profile">
              Profile
            </TabsTrigger>
          </TabsList>

          {/* ==================== TEXT ==================== */}
          <TabsContent
            value="text"
            className="p-6"
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Source panel */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      {sourceLanguageName}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {sourceLang === 'auto'
                        ? 'Automatic language detection'
                        : 'Source text'}
                    </p>
                  </div>

                  {sourceText.length > 0 && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {sourceText.length.toLocaleString()}
                      /
                      {MAX_SOURCE_TEXT_LENGTH.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Textarea
                    placeholder={
                      isPrivateMode
                        ? 'Private mode is on. Translation activity will not be saved.'
                        : 'Enter text to translate...'
                    }
                    value={sourceText}
                    onChange={(event) =>
                      setSourceText(
                        event.target.value.slice(
                          0,
                          MAX_SOURCE_TEXT_LENGTH,
                        ),
                      )
                    }
                    maxLength={
                      MAX_SOURCE_TEXT_LENGTH
                    }
                    className="h-48 resize-none bg-transparent text-base"
                    aria-label="Text to translate"
                    aria-describedby="translator-source-help"
                  />

                  {isTranslating && (
                    <div
                      className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-background/40 backdrop-blur-[1px]"
                      aria-hidden="true"
                    >
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>

                <div
                  id="translator-source-help"
                  className="flex min-h-10 items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      onClick={() => {
                        void handleListen();
                      }}
                      variant="outline"
                      size="icon"
                      disabled={
                        !isSpeechSupported ||
                        isTranslating
                      }
                      aria-label={
                        isListening
                          ? 'Stop voice input'
                          : 'Start voice input'
                      }
                      title={
                        !isSpeechSupported
                          ? 'Speech recognition is not supported'
                          : isListening
                            ? 'Stop listening'
                            : 'Voice input'
                      }
                    >
                      {isListening ? (
                        <VoiceVisualizer />
                      ) : (
                        <Mic
                          className="h-5 w-5"
                          aria-hidden="true"
                        />
                      )}
                    </Button>

                    {isListening && (
                      <span
                        className="text-sm text-muted-foreground"
                        role="status"
                      >
                        Listening...
                      </span>
                    )}

                    {!isListening &&
                      sourceLang ===
                        'auto' &&
                      detectedLangName && (
                        <div className="text-sm text-muted-foreground">
                          Detected:{' '}
                          <span className="font-medium text-foreground">
                            {detectedLangName}
                          </span>
                        </div>
                      )}
                  </div>

                  <div className="flex items-center gap-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="private-mode"
                        checked={isPrivateMode}
                        onCheckedChange={
                          setIsPrivateMode
                        }
                        aria-label="Private mode"
                      />

                      <Label
                        htmlFor="private-mode"
                        className="flex cursor-pointer items-center gap-1.5"
                      >
                        <Shield
                          className="h-4 w-4 text-primary"
                          aria-hidden="true"
                        />

                        <span className="text-sm font-medium">
                          Private
                        </span>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="speed-boost"
                        checked={
                          isSpeedBoosted
                        }
                        onCheckedChange={
                          setIsSpeedBoosted
                        }
                        aria-label="Translation speed boost"
                      />

                      <Label
                        htmlFor="speed-boost"
                        className="flex cursor-pointer items-center gap-1.5"
                      >
                        <Zap
                          className="h-4 w-4 text-amber-500"
                          aria-hidden="true"
                        />

                        <span className="text-sm font-medium">
                          Boost
                        </span>
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Tone analysis */}
                {!isSpeedBoosted &&
                  toneAnalysis && (
                    <Card className="border-dashed bg-muted/30 p-3">
                      <CardContent className="p-0">
                        <div className="flex items-start gap-3">
                          <Info
                            className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                            aria-hidden="true"
                          />

                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              Tone Analysis
                            </p>

                            <p className="text-sm text-muted-foreground">
                              {toneAnalysis}
                            </p>
                          </div>
                        </div>

                        {toneSuggestions.length >
                          0 && (
                          <div className="mt-3 border-t border-dashed pt-3">
                            <div className="flex items-start gap-3">
                              <Lightbulb
                                className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
                                aria-hidden="true"
                              />

                              <div className="min-w-0">
                                <p className="text-sm font-semibold">
                                  Suggestions
                                </p>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  {toneSuggestions.map(
                                    (
                                      suggestion,
                                      index,
                                    ) => (
                                      <Button
                                        type="button"
                                        key={`${suggestion}-${index}`}
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setSourceText(
                                            suggestion.slice(
                                              0,
                                              MAX_SOURCE_TEXT_LENGTH,
                                            ),
                                          )
                                        }
                                        className="h-auto bg-background px-2 py-1 text-xs hover:bg-muted"
                                      >
                                        {
                                          suggestion
                                        }
                                      </Button>
                                    ),
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
              </div>

              {/* Translation panel */}
              <div className="relative flex flex-col gap-4">
                <div>
                  <p className="text-sm font-semibold">
                    {targetLanguageName}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Translation
                  </p>
                </div>

                <Textarea
                  placeholder="Translation"
                  value={translatedText}
                  readOnly
                  className="h-48 resize-none bg-muted/50 text-base"
                  aria-label="Translated text"
                />

                <div className="flex h-10 items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      void handleCopyToClipboard();
                    }}
                    variant="outline"
                    size="icon"
                    disabled={!translatedText}
                    aria-label="Copy translation"
                    title="Copy translation"
                  >
                    <Copy
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                  </Button>

                  <Button
                    type="button"
                    onClick={() => {
                      if (!translatedText) {
                        return;
                      }

                      try {
                        speak({
                          text: translatedText,
                          lang: targetLang,
                        });
                      } catch (error: unknown) {
                        console.error(
                          '[Translator] Text-to-speech failed.',
                          error,
                        );

                        toast({
                          variant:
                            'destructive',
                          title:
                            'Speech Error',
                          description:
                            'Could not play the translation.',
                        });
                      }
                    }}
                    variant="outline"
                    size="icon"
                    disabled={
                      !translatedText ||
                      isSpeaking
                    }
                    aria-label="Listen to translation"
                    title="Listen to translation"
                  >
                    {isSpeaking ? (
                      <Loader2
                        className="h-5 w-5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Volume2
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    )}
                  </Button>

                  {translatedText && (
                    <Button
                      type="button"
                      onClick={handleClearText}
                      variant="ghost"
                      size="icon"
                      aria-label="Clear translation"
                      title="Clear"
                    >
                      <Trash2
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ==================== IMAGE ==================== */}
          <TabsContent
            value="image"
            className="p-6"
          >
            <ImageTranslator
              targetLang={targetLang}
              onTranslateSuccess={
                onImageTranslateSuccess
              }
            />
          </TabsContent>

          {/* ==================== LIVE ==================== */}
          <TabsContent
            value="live"
            className="p-6"
          >
            <LiveTranslator
              lang1={sourceLang}
              lang2={targetLang}
            />
          </TabsContent>

          {/* ==================== TUTOR ==================== */}
          <TabsContent
            value="tutor"
            className="p-6"
          >
            <ChatbotTutor
              targetLang={targetLang}
              onMessageSent={
                onTutorMessageSent
              }
              isPrivate={isPrivateMode}
            />
          </TabsContent>

          {/* ==================== PROFILE ==================== */}
          <TabsContent
            value="profile"
            className="p-6"
          >
            <GamificationProfile />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}