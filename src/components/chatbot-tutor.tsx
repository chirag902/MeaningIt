
'use client';

import * as React from 'react';
import {
  Send,
  Mic,
  Loader2,
  Bot,
  User,
  Volume2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { handleChatbot } from '@/app/actions';
import { languages } from '@/lib/languages';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { VoiceVisualizer } from './voice-visualizer';
import { cn } from '@/lib/utils';
import { useSpeak } from '@/hooks/use-speak';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface ChatbotTutorProps {
  targetLang: string;
  onMessageSent: () => void;
  isPrivate: boolean;
}

type ConversationTurn = {
  role: 'user' | 'assistant';
  content: string;
};

/*
 * The Speech Recognition API is not consistently included in TypeScript's
 * standard DOM typings, particularly for the WebKit implementation.
 *
 * We define only the pieces of the API that this component actually uses.
 */

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

/*
 * IMPORTANT:
 *
 * Do NOT use:
 *
 * interface SpeechRecognitionWindow extends Window
 *
 * because the browser's Window type can already contain SpeechRecognition
 * declarations depending on the installed DOM typings.
 *
 * An intersection type avoids the inheritance conflict entirely.
 */
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const MAX_MESSAGE_LENGTH = 2_000;
const MAX_HISTORY_MESSAGES = 20;

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export const ChatbotTutor = React.memo(
  function ChatbotTutor({
    targetLang,
    onMessageSent,
    isPrivate,
  }: ChatbotTutorProps) {
    const { toast } = useToast();
    const { speak, isSpeaking } = useSpeak();

    /* ---------------------------------------------------------------------- */
    /* State                                                                  */
    /* ---------------------------------------------------------------------- */

    const [conversation, setConversation] =
      React.useState<ConversationTurn[]>([]);

    const [input, setInput] = React.useState('');

    const [isLoading, setIsLoading] =
      React.useState(false);

    const [isListening, setIsListening] =
      React.useState(false);

    const [isSpeechSupported, setIsSpeechSupported] =
      React.useState(false);

    /* ---------------------------------------------------------------------- */
    /* Refs                                                                   */
    /* ---------------------------------------------------------------------- */

    const recognitionRef =
      React.useRef<SpeechRecognitionInstance | null>(
        null,
      );

    const audioStreamRef =
      React.useRef<MediaStream | null>(null);

    const scrollAnchorRef =
      React.useRef<HTMLDivElement | null>(null);

    const conversationRef =
      React.useRef<ConversationTurn[]>([]);

    const isLoadingRef =
      React.useRef(false);

    const mountedRef =
      React.useRef(true);

    const initializationIdRef =
      React.useRef(0);

    const targetLanguageRef =
      React.useRef(targetLang);

    const privateModeRef =
      React.useRef(isPrivate);

    /* ---------------------------------------------------------------------- */
    /* Synchronize refs                                                       */
    /* ---------------------------------------------------------------------- */

    React.useEffect(() => {
      conversationRef.current = conversation;
    }, [conversation]);

    React.useEffect(() => {
      isLoadingRef.current = isLoading;
    }, [isLoading]);

    React.useEffect(() => {
      targetLanguageRef.current = targetLang;
    }, [targetLang]);

    React.useEffect(() => {
      privateModeRef.current = isPrivate;
    }, [isPrivate]);

    /* ---------------------------------------------------------------------- */
    /* Language helpers                                                       */
    /* ---------------------------------------------------------------------- */

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

    const targetLanguageName = React.useMemo(
      () => getLangName(targetLang),
      [getLangName, targetLang],
    );

    /* ---------------------------------------------------------------------- */
    /* Microphone cleanup                                                     */
    /* ---------------------------------------------------------------------- */

    const stopAudioStream = React.useCallback(() => {
      const stream = audioStreamRef.current;

      if (!stream) {
        return;
      }

      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (error: unknown) {
          console.warn(
            '[ChatbotTutor] Failed to stop microphone track.',
            error,
          );
        }
      });

      audioStreamRef.current = null;
    }, []);

    /* ---------------------------------------------------------------------- */
    /* Speech recognition cleanup                                             */
    /* ---------------------------------------------------------------------- */

    const stopRecognition = React.useCallback(
      (abort = false) => {
        const recognition =
          recognitionRef.current;

        if (!recognition) {
          setIsListening(false);
          stopAudioStream();
          return;
        }

        try {
          if (abort) {
            recognition.abort();
          } else {
            recognition.stop();
          }
        } catch (error: unknown) {
          /*
           * Some browsers throw if stop/abort is called after recognition
           * has already ended. This is safe to ignore.
           */
          console.debug(
            '[ChatbotTutor] Speech recognition cleanup:',
            error,
          );
        }

        setIsListening(false);
        stopAudioStream();
      },
      [stopAudioStream],
    );

    /* ---------------------------------------------------------------------- */
    /* Send message                                                           */
    /* ---------------------------------------------------------------------- */

    const handleSendMessage = React.useCallback(
      async (rawText: string) => {
        const text = rawText.trim();

        if (!text) {
          return;
        }

        if (isLoadingRef.current) {
          return;
        }

        if (text.length > MAX_MESSAGE_LENGTH) {
          toast({
            variant: 'destructive',
            title: 'Message too long',
            description: `Please keep your message under ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`,
          });
          return;
        }

        const currentConversation =
          conversationRef.current;

        const newUserMessage: ConversationTurn = {
          role: 'user',
          content: text,
        };

        const nextConversation = [
          ...currentConversation,
          newUserMessage,
        ].slice(-MAX_HISTORY_MESSAGES);

        conversationRef.current =
          nextConversation;

        setConversation(nextConversation);
        setInput('');
        setIsLoading(true);
        isLoadingRef.current = true;

        onMessageSent();

        try {
          const history = privateModeRef.current
            ? []
            : currentConversation
                .filter(
                  (
                    message,
                  ): message is ConversationTurn =>
                    message.role === 'user' ||
                    message.role === 'assistant',
                )
                .slice(-MAX_HISTORY_MESSAGES);

          const result = await handleChatbot({
            userInput: text,
            targetLanguage: getLangName(
              targetLanguageRef.current,
            ),
            history,
          });

          if (!mountedRef.current) {
            return;
          }

          /*
           * Explicit discriminated-union narrowing.
           *
           * Do not access result.error until after checking
           * result.success === false.
           */
          if (result.success) {
            const response =
              result.response.trim();

            if (!response) {
              toast({
                variant: 'destructive',
                title: 'Chatbot Error',
                description:
                  'The tutor returned an empty response. Please try again.',
              });
              return;
            }

            const newAssistantMessage: ConversationTurn =
              {
                role: 'assistant',
                content: response,
              };

            const updatedConversation = [
              ...conversationRef.current,
              newAssistantMessage,
            ].slice(-MAX_HISTORY_MESSAGES);

            conversationRef.current =
              updatedConversation;

            setConversation(
              updatedConversation,
            );

            return;
          }

          /*
           * At this point TypeScript knows result is the failure branch.
           */
          toast({
            variant: 'destructive',
            title: 'Chatbot Error',
            description:
              result.error ||
              'The chatbot failed to respond. Please try again.',
          });
        } catch (error: unknown) {
          if (!mountedRef.current) {
            return;
          }

          console.error(
            '[ChatbotTutor] Failed to send message.',
            error,
          );

          toast({
            variant: 'destructive',
            title: 'Chatbot Error',
            description:
              'Something went wrong while contacting the tutor. Please try again.',
          });
        } finally {
          if (mountedRef.current) {
            setIsLoading(false);
          }

          isLoadingRef.current = false;
        }
      },
      [getLangName, onMessageSent, toast],
    );

    /* ---------------------------------------------------------------------- */
    /* Conversation initialization                                            */
    /* ---------------------------------------------------------------------- */

    React.useEffect(() => {
      mountedRef.current = true;

      const initializationId =
        ++initializationIdRef.current;

      const initializeConversation =
        async () => {
          stopRecognition(true);

          setInput('');
          setIsLoading(true);
          isLoadingRef.current = true;

          setConversation([]);
          conversationRef.current = [];

          if (isPrivate) {
            const privateGreeting: ConversationTurn =
              {
                role: 'assistant',
                content: `Private session started in ${targetLanguageName}. History will not be saved.`,
              };

            if (
              mountedRef.current &&
              initializationId ===
                initializationIdRef.current
            ) {
              setConversation([
                privateGreeting,
              ]);

              conversationRef.current = [
                privateGreeting,
              ];

              setIsLoading(false);
              isLoadingRef.current = false;
            }

            return;
          }

          try {
            const result = await handleChatbot({
              userInput: `Hi, please introduce yourself as my ${targetLanguageName} tutor.`,
              targetLanguage:
                targetLanguageName,
              history: [],
            });

            if (
              !mountedRef.current ||
              initializationId !==
                initializationIdRef.current
            ) {
              return;
            }

            if (result.success) {
              const response =
                result.response.trim();

              if (response) {
                const greeting: ConversationTurn =
                  {
                    role: 'assistant',
                    content: response,
                  };

                setConversation([greeting]);
                conversationRef.current = [
                  greeting,
                ];
              } else {
                setConversation([
                  {
                    role: 'assistant',
                    content: `Hello! I am Kai, your language tutor for ${targetLanguageName}. What would you like to talk about today?`,
                  },
                ]);
              }
            } else {
              /*
               * result.error is safe here because result.success === false.
               */
              const fallbackGreeting: ConversationTurn =
                {
                  role: 'assistant',
                  content: `Hello! I am Kai, your language tutor for ${targetLanguageName}. What would you like to talk about today?`,
                };

              setConversation([
                fallbackGreeting,
              ]);

              conversationRef.current = [
                fallbackGreeting,
              ];

              toast({
                variant: 'destructive',
                title: 'Chatbot Error',
                description:
                  result.error ||
                  'Could not start the conversation.',
              });
            }
          } catch (error: unknown) {
            if (
              !mountedRef.current ||
              initializationId !==
                initializationIdRef.current
            ) {
              return;
            }

            console.error(
              '[ChatbotTutor] Failed to initialize conversation.',
              error,
            );

            const fallbackGreeting: ConversationTurn =
              {
                role: 'assistant',
                content: `Hello! I am Kai, your language tutor for ${targetLanguageName}. What would you like to talk about today?`,
              };

            setConversation([
              fallbackGreeting,
            ]);

            conversationRef.current = [
              fallbackGreeting,
            ];

            toast({
              variant: 'destructive',
              title: 'Chatbot Error',
              description:
                'Could not start the conversation. You can still try sending a message.',
            });
          } finally {
            if (
              mountedRef.current &&
              initializationId ===
                initializationIdRef.current
            ) {
              setIsLoading(false);
              isLoadingRef.current = false;
            }
          }
        };

      void initializeConversation();

      return () => {
        initializationIdRef.current += 1;
      };
    }, [
      isPrivate,
      stopRecognition,
      targetLanguageName,
      toast,
    ]);

    /* ---------------------------------------------------------------------- */
    /* Auto-scroll                                                            */
    /* ---------------------------------------------------------------------- */

    React.useEffect(() => {
      const anchor =
        scrollAnchorRef.current;

      if (!anchor) {
        return;
      }

      anchor.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }, [conversation, isLoading]);

    /* ---------------------------------------------------------------------- */
    /* Speech recognition initialization                                      */
    /* ---------------------------------------------------------------------- */

    React.useEffect(() => {
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
      recognition.lang = targetLang;

      recognition.onstart = () => {
        if (!mountedRef.current) {
          return;
        }

        setIsListening(true);
      };

      recognition.onresult = (
        event: SpeechRecognitionEventLike,
      ) => {
        if (!mountedRef.current) {
          return;
        }

        const result =
          event.results[event.resultIndex];

        if (!result) {
          return;
        }

        const alternative = result[0];

        if (!alternative) {
          return;
        }

        const spokenText =
          alternative.transcript.trim();

        if (!spokenText) {
          return;
        }

        setInput(spokenText);

        stopAudioStream();

        void handleSendMessage(
          spokenText,
        );
      };

      recognition.onerror = (
        event: SpeechRecognitionErrorEventLike,
      ) => {
        if (!mountedRef.current) {
          return;
        }

        setIsListening(false);
        stopAudioStream();

        /*
         * "no-speech" is normal when the user remains silent.
         * Do not show an error toast for it.
         */
        if (
          event.error === 'no-speech' ||
          event.error === 'aborted'
        ) {
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

        toast({
          variant: 'destructive',
          title: 'Speech Error',
          description,
        });
      };

      recognition.onend = () => {
        if (!mountedRef.current) {
          return;
        }

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
          /*
           * Recognition may already have ended.
           */
        }

        if (
          recognitionRef.current ===
          recognition
        ) {
          recognitionRef.current = null;
        }

        stopAudioStream();

        if (mountedRef.current) {
          setIsListening(false);
        }
      };
    }, [
      handleSendMessage,
      stopAudioStream,
      targetLang,
      toast,
    ]);

    /* ---------------------------------------------------------------------- */
    /* Microphone handler                                                     */
    /* ---------------------------------------------------------------------- */

    const handleListen = React.useCallback(
      async () => {
        const recognition =
          recognitionRef.current;

        if (
          !recognition ||
          !isSpeechSupported
        ) {
          toast({
            variant: 'destructive',
            title:
              'Speech recognition unavailable',
            description:
              'Your current browser does not support speech recognition.',
          });
          return;
        }

        if (isLoadingRef.current) {
          return;
        }

        if (isListening) {
          stopRecognition(false);
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

          audioStreamRef.current =
            stream;

          recognition.lang = targetLang;
          recognition.continuous = false;
          recognition.interimResults = false;

          try {
            recognition.start();
          } catch (error: unknown) {
            stopAudioStream();

            console.error(
              '[ChatbotTutor] Could not start speech recognition.',
              error,
            );

            toast({
              variant: 'destructive',
              title: 'Microphone Error',
              description:
                'Could not start speech recognition. Please try again.',
            });
          }
        } catch (error: unknown) {
          stopAudioStream();

          console.error(
            '[ChatbotTutor] Microphone access failed.',
            error,
          );

          const description =
            error instanceof DOMException &&
            error.name === 'NotAllowedError'
              ? 'Microphone access was denied. Please allow microphone permission in your browser settings.'
              : 'Could not access the microphone. Please check your microphone and browser permissions.';

          toast({
            variant: 'destructive',
            title: 'Microphone Error',
            description,
          });

          setIsListening(false);
        }
      },
      [
        isListening,
        isSpeechSupported,
        stopAudioStream,
        stopRecognition,
        targetLang,
        toast,
      ],
    );

    /* ---------------------------------------------------------------------- */
    /* Form submission                                                        */
    /* ---------------------------------------------------------------------- */

    const handleSubmit =
      React.useCallback(
        (
          event: React.FormEvent<HTMLFormElement>,
        ) => {
          event.preventDefault();

          if (isLoadingRef.current) {
            return;
          }

          void handleSendMessage(input);
        },
        [handleSendMessage, input],
      );

    /* ---------------------------------------------------------------------- */
    /* Keyboard handling                                                      */
    /* ---------------------------------------------------------------------- */

    const handleInputKeyDown =
      React.useCallback(
        (
          event: React.KeyboardEvent<HTMLTextAreaElement>,
        ) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey
          ) {
            event.preventDefault();

            if (!isLoadingRef.current) {
              void handleSendMessage(
                input,
              );
            }
          }
        },
        [handleSendMessage, input],
      );

    /* ---------------------------------------------------------------------- */
    /* Component cleanup                                                      */
    /* ---------------------------------------------------------------------- */

    React.useEffect(() => {
      return () => {
        mountedRef.current = false;

        try {
          recognitionRef.current?.abort();
        } catch {
          // Ignore browser cleanup errors.
        }

        recognitionRef.current = null;
        stopAudioStream();
      };
    }, [stopAudioStream]);

    /* ---------------------------------------------------------------------- */
    /* Render                                                                 */
    /* ---------------------------------------------------------------------- */

    return (
      <Card className="flex h-[65vh] w-full flex-col">
        <ScrollArea className="flex-1 p-4">
          <div
            className="space-y-6"
            aria-live="polite"
            aria-label="Language tutor conversation"
          >
            {conversation.map(
              (turn, index) => {
                const messageKey = `${turn.role}-${index}-${turn.content.slice(
                  0,
                  24,
                )}`;

                return (
                  <div
                    key={messageKey}
                    className={cn(
                      'flex items-start gap-3',
                      turn.role === 'user'
                        ? 'justify-end'
                        : 'justify-start',
                    )}
                  >
                    {turn.role ===
                      'assistant' && (
                      <Avatar className="shrink-0">
                        <AvatarFallback aria-label="AI tutor">
                          <Bot
                            className="h-5 w-5"
                            aria-hidden="true"
                          />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div
                      className={cn(
                        'group relative max-w-xs rounded-lg p-3 md:max-w-md lg:max-w-lg',
                        turn.role ===
                          'assistant'
                          ? 'bg-muted'
                          : 'bg-primary text-primary-foreground',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {turn.content}
                      </p>

                      {turn.role ===
                        'assistant' && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className={cn(
                            'absolute -bottom-4 -right-2 h-7 w-7',
                            'opacity-0 transition-opacity',
                            'group-hover:opacity-100',
                            'focus-visible:opacity-100',
                          )}
                          onClick={() =>
                            speak({
                              text: turn.content,
                              lang: targetLang,
                            })
                          }
                          disabled={isSpeaking}
                          aria-label="Listen to tutor response"
                          title="Listen to response"
                        >
                          <Volume2
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </Button>
                      )}
                    </div>

                    {turn.role === 'user' && (
                      <Avatar className="shrink-0">
                        <AvatarFallback aria-label="You">
                          <User
                            className="h-5 w-5"
                            aria-hidden="true"
                          />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              },
            )}

            {isLoading &&
              conversation[
                conversation.length - 1
              ]?.role === 'user' && (
                <div
                  className="flex items-start gap-3"
                  role="status"
                  aria-label="Tutor is typing"
                >
                  <Avatar className="shrink-0">
                    <AvatarFallback>
                      <Bot
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    </AvatarFallback>
                  </Avatar>

                  <div className="rounded-lg bg-muted p-3">
                    <Loader2
                      className="h-5 w-5 animate-spin"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              )}

            <div ref={scrollAnchorRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2"
          >
            <Textarea
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value.slice(
                    0,
                    MAX_MESSAGE_LENGTH,
                  ),
                )
              }
              onKeyDown={handleInputKeyDown}
              placeholder={
                isPrivate
                  ? `Private chat in ${targetLanguageName}...`
                  : `Practice your ${targetLanguageName}...`
              }
              className="max-h-40 min-h-12 resize-none"
              disabled={isLoading}
              maxLength={MAX_MESSAGE_LENGTH}
              aria-label="Message your language tutor"
              aria-describedby="chatbot-input-hint"
            />

            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="icon"
                variant={
                  isListening
                    ? 'destructive'
                    : 'outline'
                }
                onClick={() => {
                  void handleListen();
                }}
                disabled={
                  !isSpeechSupported ||
                  isLoading
                }
                aria-label={
                  isListening
                    ? 'Stop listening'
                    : 'Start voice input'
                }
                title={
                  isSpeechSupported
                    ? isListening
                      ? 'Stop listening'
                      : 'Speak'
                    : 'Speech recognition is not supported'
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

              <Button
                type="submit"
                size="icon"
                disabled={
                  isLoading ||
                  !input.trim()
                }
                aria-label="Send message"
                title="Send message"
              >
                {isLoading ? (
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                )}
              </Button>
            </div>
          </form>

          <div
            id="chatbot-input-hint"
            className="mt-2 flex justify-between text-xs text-muted-foreground"
          >
            <span>
              Press Enter to send · Shift + Enter
              for a new line
            </span>

            <span
              aria-live="polite"
              className="tabular-nums"
            >
              {input.length.toLocaleString()}/
              {MAX_MESSAGE_LENGTH.toLocaleString()}
            </span>
          </div>
        </div>
      </Card>
    );
  },
);
