'use client';

import * as React from 'react';
import {
  Mic,
  Loader2,
  User,
  Bot,
  Languages,
  Square,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { handleTranslation } from '@/app/actions';
import { languages } from '@/lib/languages';
import { Card, CardContent } from './ui/card';
import { VoiceVisualizer } from './voice-visualizer';
import { useSpeak } from '@/hooks/use-speak';

interface LiveTranslatorProps {
  lang1: string;
  lang2: string;
}

type Speaker = 'user1' | 'user2';

type ConversationTurn = {
  id: string;
  speaker: Speaker;
  originalText: string;
  translatedText: string;
};

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

const MAX_CONVERSATION_TURNS = 50;
const MAX_SPOKEN_TEXT_LENGTH = 2_000;

export const LiveTranslator = React.memo(function LiveTranslator({
  lang1,
  lang2,
}: LiveTranslatorProps) {
  const { toast } = useToast();
  const { speak } = useSpeak();

  const [conversation, setConversation] = React.useState<
    ConversationTurn[]
  >([]);
  const [isListening, setIsListening] =
    React.useState<Speaker | null>(null);
  const [isProcessing, setIsProcessing] =
    React.useState(false);
  const [isSpeechSupported, setIsSpeechSupported] =
    React.useState(false);

  const recognitionRef =
    React.useRef<SpeechRecognitionInstance | null>(null);

  const audioStreamRef =
    React.useRef<MediaStream | null>(null);

  const conversationEndRef =
    React.useRef<HTMLDivElement | null>(null);

  const activeSpeakerRef =
    React.useRef<Speaker | null>(null);

  const isProcessingRef =
    React.useRef(false);

  const mountedRef =
    React.useRef(true);

  const requestIdRef =
    React.useRef(0);

  const lang1Ref =
    React.useRef(lang1);

  const lang2Ref =
    React.useRef(lang2);

  const isListeningRef =
    React.useRef<Speaker | null>(null);

  React.useEffect(() => {
    lang1Ref.current = lang1;
  }, [lang1]);

  React.useEffect(() => {
    lang2Ref.current = lang2;
  }, [lang2]);

  React.useEffect(() => {
    isListeningRef.current = isListening;
    activeSpeakerRef.current = isListening;
  }, [isListening]);

  React.useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  const getLangName = React.useCallback(
    (code: string): string => {
      return (
        languages.find(
          (language) => language.code === code,
        )?.name ?? code
      );
    },
    [],
  );

  const getLanguageCodeForSpeaker =
    React.useCallback((speaker: Speaker): string => {
      return speaker === 'user1'
        ? lang1Ref.current
        : lang2Ref.current;
    }, []);

  const getTargetLanguageCodeForSpeaker =
    React.useCallback((speaker: Speaker): string => {
      return speaker === 'user1'
        ? lang2Ref.current
        : lang1Ref.current;
    }, []);

  const stopAudioStream = React.useCallback(() => {
    const stream = audioStreamRef.current;

    if (!stream) return;

    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (error: unknown) {
        console.debug(
          '[LiveTranslator] Failed to stop microphone track.',
          error,
        );
      }
    });

    audioStreamRef.current = null;
  }, []);

  const stopRecognition = React.useCallback(
    (abort = false) => {
      const recognition = recognitionRef.current;

      if (recognition) {
        try {
          if (abort) {
            recognition.abort();
          } else {
            recognition.stop();
          }
        } catch (error: unknown) {
          console.debug(
            '[LiveTranslator] Speech recognition cleanup.',
            error,
          );
        }
      }

      isListeningRef.current = null;
      activeSpeakerRef.current = null;
      setIsListening(null);

      stopAudioStream();
    },
    [stopAudioStream],
  );

  const addConversationTurn = React.useCallback(
    (
      speaker: Speaker,
      originalText: string,
      translatedText: string,
    ) => {
      const cleanOriginalText = originalText
        .trim()
        .slice(0, MAX_SPOKEN_TEXT_LENGTH);

      const cleanTranslatedText = translatedText.trim();

      if (
        !cleanOriginalText ||
        !cleanTranslatedText
      ) {
        return;
      }

      const newTurn: ConversationTurn = {
        id: `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`,
        speaker,
        originalText: cleanOriginalText,
        translatedText: cleanTranslatedText,
      };

      setConversation((previous) =>
        [...previous, newTurn].slice(
          -MAX_CONVERSATION_TURNS,
        ),
      );
    },
    [],
  );

  const translateSpeech = React.useCallback(
    async (
      spokenText: string,
      speaker: Speaker,
    ) => {
      const cleanText = spokenText
        .trim()
        .slice(0, MAX_SPOKEN_TEXT_LENGTH);

      if (!cleanText) return;

      const sourceLanguageCode =
        getLanguageCodeForSpeaker(speaker);

      const targetLanguageCode =
        getTargetLanguageCodeForSpeaker(speaker);

      if (
        sourceLanguageCode === 'auto' ||
        targetLanguageCode === 'auto'
      ) {
        toast({
          variant: 'destructive',
          title: 'Select a language',
          description:
            'Live translation requires a specific source and target language.',
        });
        return;
      }

      const sourceLanguageName =
        getLangName(sourceLanguageCode);

      const targetLanguageName =
        getLangName(targetLanguageCode);

      if (
        !sourceLanguageName ||
        !targetLanguageName
      ) {
        toast({
          variant: 'destructive',
          title: 'Language Error',
          description:
            'The selected language could not be resolved. Please select the languages again.',
        });
        return;
      }

      const requestId = ++requestIdRef.current;

      setIsProcessing(true);
      isProcessingRef.current = true;

      try {
        const translationResult =
          await handleTranslation({
            text: cleanText,
            sourceLanguage: sourceLanguageName,
            targetLanguage: targetLanguageName,
            isSpeedBoosted: true,
          });

        if (!mountedRef.current) return;

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (
          translationResult.success &&
          translationResult.translation?.trim()
        ) {
          const translatedText =
            translationResult.translation.trim();

          addConversationTurn(
            speaker,
            cleanText,
            translatedText,
          );

          try {
            await Promise.resolve(
              speak({
                text: translatedText,
                lang: targetLanguageCode,
              }),
            );
          } catch (error: unknown) {
            console.debug(
              '[LiveTranslator] Text-to-speech failed.',
              error,
            );
          }

          return;
        }

        const errorMessage =
          'error' in translationResult
            ? translationResult.error
            : undefined;

        toast({
          variant: 'destructive',
          title: 'Translation Error',
          description:
            errorMessage ||
            'Could not translate the speech. Please try again.',
        });
      } catch (error: unknown) {
        if (!mountedRef.current) return;

        console.error(
          '[LiveTranslator] Translation failed.',
          error,
        );

        toast({
          variant: 'destructive',
          title: 'Translation Error',
          description:
            'Something went wrong while translating the speech. Please try again.',
        });
      } finally {
        if (
          mountedRef.current &&
          requestId === requestIdRef.current
        ) {
          setIsProcessing(false);
          isProcessingRef.current = false;
        }
      }
    },
    [
      addConversationTurn,
      getLanguageCodeForSpeaker,
      getLangName,
      getTargetLanguageCodeForSpeaker,
      speak,
      toast,
    ],
  );

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
    recognition.lang = lang1;

    recognition.onstart = () => {
      if (!mountedRef.current) return;

      const speaker = activeSpeakerRef.current;

      if (speaker) {
        setIsListening(speaker);
      }
    };

    recognition.onresult = (
      event: SpeechRecognitionEventLike,
    ) => {
      if (!mountedRef.current) return;

      const currentSpeaker =
        activeSpeakerRef.current;

      if (!currentSpeaker) return;

      const result =
        event.results[event.resultIndex];

      if (!result) return;

      const alternative = result[0];

      if (!alternative) return;

      const spokenText =
        alternative.transcript.trim();

      stopAudioStream();

      if (!spokenText) {
        return;
      }

      if (
        spokenText.length >
        MAX_SPOKEN_TEXT_LENGTH
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

      stopRecognition(false);

      void translateSpeech(
        spokenText,
        currentSpeaker,
      );
    };

    recognition.onerror = (
      event: SpeechRecognitionErrorEventLike,
    ) => {
      if (!mountedRef.current) return;

      stopAudioStream();

      const errorCode = event.error;

      if (
        errorCode === 'no-speech' ||
        errorCode === 'aborted'
      ) {
        setIsListening(null);
        isListeningRef.current = null;
        activeSpeakerRef.current = null;
        return;
      }

      let description =
        'Speech recognition failed. Please try again.';

      switch (errorCode) {
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

        case 'service-not-allowed':
          description =
            'Your browser blocked the speech recognition service. Please try again or use a supported browser.';
          break;

        default:
          break;
      }

      console.error(
        '[LiveTranslator] Speech recognition error:',
        errorCode,
        event.message,
      );

      toast({
        variant: 'destructive',
        title: 'Speech Error',
        description,
      });

      setIsListening(null);
      isListeningRef.current = null;
      activeSpeakerRef.current = null;
    };

    recognition.onend = () => {
      if (!mountedRef.current) return;

      setIsListening(null);
      isListeningRef.current = null;
      activeSpeakerRef.current = null;

      stopAudioStream();
    };

    recognitionRef.current = recognition;
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
        recognitionRef.current === recognition
      ) {
        recognitionRef.current = null;
      }

      stopAudioStream();

      if (mountedRef.current) {
        setIsListening(null);
      }
    };
  }, [
    stopAudioStream,
    stopRecognition,
    toast,
    translateSpeech,
    lang1,
  ]);

  React.useEffect(() => {
    const recognition =
      recognitionRef.current;

    if (!recognition) return;

    const activeSpeaker =
      activeSpeakerRef.current;

    if (!activeSpeaker) {
      recognition.lang = lang1;
      return;
    }

    recognition.lang =
      activeSpeaker === 'user1'
        ? lang1
        : lang2;
  }, [lang1, lang2]);

  React.useEffect(() => {
    const element =
      conversationEndRef.current;

    if (!element) return;

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [conversation]);

  React.useEffect(() => {
    return () => {
      mountedRef.current = false;

      requestIdRef.current += 1;

      try {
        recognitionRef.current?.abort();
      } catch {
        // Ignore browser cleanup errors.
      }

      recognitionRef.current = null;

      activeSpeakerRef.current = null;
      isListeningRef.current = null;

      stopAudioStream();
    };
  }, [stopAudioStream]);

  const handleToggleListen =
    React.useCallback(
      async (speaker: Speaker) => {
        const recognition =
          recognitionRef.current;

        if (!recognition) {
          toast({
            variant: 'destructive',
            title: 'Speech recognition unavailable',
            description:
              'Your current browser does not support speech recognition.',
          });
          return;
        }

        if (isProcessingRef.current) {
          return;
        }

        if (isListeningRef.current === speaker) {
          stopRecognition(false);
          return;
        }

        if (isListeningRef.current !== null) {
          stopRecognition(true);
          return;
        }

        const sourceLanguageCode =
          speaker === 'user1'
            ? lang1
            : lang2;

        if (
          !sourceLanguageCode ||
          sourceLanguageCode === 'auto'
        ) {
          toast({
            variant: 'destructive',
            title: 'Select a language',
            description:
              `Please select a specific language for ${
                speaker === 'user1'
                  ? 'Speaker 1'
                  : 'Speaker 2'
              } before starting voice input.`,
          });
          return;
        }

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

          activeSpeakerRef.current = speaker;
          isListeningRef.current = speaker;

          recognition.lang =
            sourceLanguageCode;

          recognition.continuous = false;
          recognition.interimResults = false;

          try {
            recognition.start();
            setIsListening(speaker);
          } catch (error: unknown) {
            stopAudioStream();

            activeSpeakerRef.current = null;
            isListeningRef.current = null;
            setIsListening(null);

            console.error(
              '[LiveTranslator] Could not start speech recognition.',
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

          activeSpeakerRef.current = null;
          isListeningRef.current = null;
          setIsListening(null);

          console.error(
            '[LiveTranslator] Microphone access failed.',
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
        }
      },
      [
        lang1,
        lang2,
        stopAudioStream,
        stopRecognition,
        toast,
      ],
    );

  const clearConversation =
    React.useCallback(() => {
      if (isListeningRef.current) {
        stopRecognition(true);
      }

      requestIdRef.current += 1;

      setConversation([]);
      setIsProcessing(false);
      isProcessingRef.current = false;
    }, [stopRecognition]);

  const getSpeakerLanguageName =
    React.useCallback(
      (speaker: Speaker): string => {
        return getLangName(
          speaker === 'user1'
            ? lang1
            : lang2,
        );
      },
      [getLangName, lang1, lang2],
    );

  const getTargetLanguageName =
    React.useCallback(
      (speaker: Speaker): string => {
        return getLangName(
          speaker === 'user1'
            ? lang2
            : lang1,
        );
      },
      [getLangName, lang1, lang2],
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        {/* Speaker 1 */}
        <div
          className="flex flex-col items-center gap-3 rounded-lg border bg-background/50 p-4"
          aria-label={`Speaker 1 - ${getLangName(lang1)}`}
        >
          <div className="flex items-center gap-2">
            <User
              className="h-6 w-6 text-primary"
              aria-hidden="true"
            />

            <span className="text-lg font-semibold">
              {getLangName(lang1)}
            </span>
          </div>

          <Button
            type="button"
            onClick={() =>
              void handleToggleListen('user1')
            }
            disabled={
              !isSpeechSupported ||
              isProcessing ||
              (isListening !== null &&
                isListening !== 'user1')
            }
            size="lg"
            className="h-20 w-20 rounded-full"
            aria-label={
              isListening === 'user1'
                ? 'Stop listening for speaker 1'
                : 'Start listening for speaker 1'
            }
            title={
              !isSpeechSupported
                ? 'Speech recognition is not supported'
                : isListening === 'user1'
                  ? 'Stop listening'
                  : 'Tap to speak'
            }
          >
            {isListening === 'user1' ? (
              <VoiceVisualizer />
            ) : (
              <Mic
                className="h-8 w-8"
                aria-hidden="true"
              />
            )}
          </Button>

          <p className="h-4 text-sm text-muted-foreground">
            {isListening === 'user1'
              ? 'Listening...'
              : lang1 === 'auto'
                ? 'Select a language'
                : 'Tap to speak'}
          </p>
        </div>

        {/* Speaker 2 */}
        <div
          className="flex flex-col items-center gap-3 rounded-lg border bg-background/50 p-4"
          aria-label={`Speaker 2 - ${getLangName(lang2)}`}
        >
          <div className="flex items-center gap-2">
            <Bot
              className="h-6 w-6 text-accent"
              aria-hidden="true"
            />

            <span className="text-lg font-semibold">
              {getLangName(lang2)}
            </span>
          </div>

          <Button
            type="button"
            onClick={() =>
              void handleToggleListen('user2')
            }
            disabled={
              !isSpeechSupported ||
              isProcessing ||
              (isListening !== null &&
                isListening !== 'user2')
            }
            size="lg"
            className="h-20 w-20 rounded-full"
            variant="secondary"
            aria-label={
              isListening === 'user2'
                ? 'Stop listening for speaker 2'
                : 'Start listening for speaker 2'
            }
            title={
              !isSpeechSupported
                ? 'Speech recognition is not supported'
                : isListening === 'user2'
                  ? 'Stop listening'
                  : 'Tap to speak'
            }
          >
            {isListening === 'user2' ? (
              <VoiceVisualizer />
            ) : (
              <Mic
                className="h-8 w-8"
                aria-hidden="true"
              />
            )}
          </Button>

          <p className="h-4 text-sm text-muted-foreground">
            {isListening === 'user2'
              ? 'Listening...'
              : lang2 === 'auto'
                ? 'Select a language'
                : 'Tap to speak'}
          </p>
        </div>
      </div>

      {/* Conversation history */}
      <div className="mt-4 overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Languages
              className="h-5 w-5 text-primary"
              aria-hidden="true"
            />

            <h2 className="font-semibold">
              Live Translation
            </h2>
          </div>

          {conversation.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearConversation}
              disabled={isProcessing}
            >
              Clear
            </Button>
          )}
        </div>

        <div
          className="max-h-[40vh] space-y-4 overflow-y-auto p-4"
          aria-live="polite"
          aria-label="Live translation history"
        >
          {isProcessing && (
            <div
              className="flex items-center justify-center gap-3 rounded-lg bg-muted/40 p-6"
              role="status"
              aria-label="Translating speech"
            >
              <Loader2
                className="h-6 w-6 animate-spin text-primary"
                aria-hidden="true"
              />

              <p className="text-sm font-medium">
                Translating...
              </p>
            </div>
          )}

          {conversation.map((turn) => (
            <Card
              key={turn.id}
              className={
                turn.speaker === 'user1'
                  ? 'bg-primary/10'
                  : 'bg-accent/10'
              }
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-muted-foreground">
                      {getSpeakerLanguageName(
                        turn.speaker,
                      )}{' '}
                      said:
                    </p>

                    <p className="mt-1 break-words italic">
                      “{turn.originalText}”
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() =>
                      void Promise.resolve(
                        speak({
                          text: turn.translatedText,
                          lang:
                            turn.speaker ===
                            'user1'
                              ? lang2
                              : lang1,
                        }),
                      )
                    }
                    aria-label="Play translation"
                    title="Play translation"
                  >
                    <Mic
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </Button>
                </div>

                <p className="mt-3 text-sm font-semibold text-muted-foreground">
                  Translated to{' '}
                  {getTargetLanguageName(
                    turn.speaker,
                  )}
                  :
                </p>

                <p className="mt-1 break-words text-lg font-bold">
                  {turn.translatedText}
                </p>
              </CardContent>
            </Card>
          ))}

          {!isProcessing &&
            conversation.length === 0 && (
              <div className="flex flex-col items-center gap-4 p-8 text-center text-muted-foreground">
                <Languages
                  className="h-12 w-12"
                  aria-hidden="true"
                />

                <div>
                  <p className="font-medium">
                    Start a live conversation
                  </p>

                  <p className="mt-1 text-sm">
                    Tap either microphone and speak.
                    Your speech will be translated
                    into the other selected language.
                  </p>
                </div>

                {(lang1 === 'auto' ||
                  lang2 === 'auto') && (
                  <p className="text-sm text-destructive">
                    Please select specific
                    languages for both speakers
                    before starting.
                  </p>
                )}

                {!isSpeechSupported && (
                  <p className="text-sm text-destructive">
                    Speech recognition is not
                    supported by your current
                    browser.
                  </p>
                )}
              </div>
            )}

          <div ref={conversationEndRef} />
        </div>
      </div>

      {isListening && (
        <div
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <VoiceVisualizer />

          <span>
            Listening for{' '}
            {getSpeakerLanguageName(
              isListening,
            )}
            ...
          </span>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              stopRecognition(true)
            }
          >
            <Square
              className="mr-1 h-3.5 w-3.5"
              aria-hidden="true"
            />
            Stop
          </Button>
        </div>
      )}
    </div>
  );
});