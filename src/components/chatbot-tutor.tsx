'use client';

import * as React from 'react';
import { Send, Mic, Loader2, Bot, User, Volume2 } from 'lucide-react';

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
  id: number;
  role: 'user' | 'assistant';
  content: string;
  /** Local-only messages (the greeting) are never sent to the AI as history. */
  isLocal?: boolean;
};

// The Speech Recognition API is missing from TypeScript's standard DOM typings.
// Only the parts this component uses are declared.
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

/* -------------------------------------------------------------------------- */
/* Constants and helpers                                                      */
/* -------------------------------------------------------------------------- */

const MAX_MESSAGE_LENGTH = 2_000;
const MAX_DISPLAY_MESSAGES = 100;
// Must stay within the limits enforced by actions.ts.
const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_MESSAGE_LENGTH = 1_500;

function getLanguageName(code: string): string {
  return languages.find((language) => language.code === code)?.name ?? code;
}

/** Trims history to what the server accepts. Assistant replies can exceed 1,500 characters. */
function buildHistory(turns: ConversationTurn[]) {
  return turns
    .filter((turn) => !turn.isLocal)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((turn) => ({
      role: turn.role,
      content: turn.content.slice(0, MAX_HISTORY_MESSAGE_LENGTH),
    }));
}

/* -------------------------------------------------------------------------- */
/* Message bubble (memoized: typing in the input doesn't re-render the list)  */
/* -------------------------------------------------------------------------- */

interface MessageBubbleProps {
  turn: ConversationTurn;
  onSpeak: (text: string) => void;
  speakDisabled: boolean;
}

const MessageBubble = React.memo(function MessageBubble({
  turn,
  onSpeak,
  speakDisabled,
}: MessageBubbleProps) {
  const isAssistant = turn.role === 'assistant';

  return (
    <div className={cn('flex items-start gap-3', isAssistant ? 'justify-start' : 'justify-end')}>
      {isAssistant && (
        <Avatar className="shrink-0">
          <AvatarFallback aria-label="AI tutor">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          'group relative max-w-xs rounded-lg p-3 md:max-w-md lg:max-w-lg',
          isAssistant ? 'bg-muted' : 'bg-primary text-primary-foreground',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{turn.content}</p>

        {isAssistant && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            // Always visible on touch screens (no hover there); hover-reveal from md up.
            className={cn(
              'absolute -bottom-4 -right-2 h-7 w-7',
              'opacity-100 transition-opacity md:opacity-0',
              'md:group-hover:opacity-100 focus-visible:opacity-100',
            )}
            onClick={() => onSpeak(turn.content)}
            disabled={speakDisabled}
            aria-label="Listen to tutor response"
            title="Listen to response"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      {!isAssistant && (
        <Avatar className="shrink-0">
          <AvatarFallback aria-label="You">
            <User className="h-5 w-5" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export const ChatbotTutor = React.memo(function ChatbotTutor({
  targetLang,
  onMessageSent,
  isPrivate,
}: ChatbotTutorProps) {
  const { toast } = useToast();
  const { speak, isSpeaking } = useSpeak();

  /* ------------------------------- State -------------------------------- */

  const [conversation, setConversation] = React.useState<ConversationTurn[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = React.useState(false);

  /* -------------------------------- Refs -------------------------------- */

  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);
  const scrollAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const conversationRef = React.useRef<ConversationTurn[]>([]);
  const isLoadingRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const idCounterRef = React.useRef(0);

  // Bumped whenever the language or private mode changes, so replies that
  // belong to an old conversation are discarded.
  const sessionIdRef = React.useRef(0);

  const targetLangRef = React.useRef(targetLang);
  const privateModeRef = React.useRef(isPrivate);
  const onMessageSentRef = React.useRef(onMessageSent);

  React.useEffect(() => {
    targetLangRef.current = targetLang;
    privateModeRef.current = isPrivate;
    onMessageSentRef.current = onMessageSent;
  }, [targetLang, isPrivate, onMessageSent]);

  const targetLanguageName = React.useMemo(() => getLanguageName(targetLang), [targetLang]);

  const nextId = React.useCallback(() => {
    idCounterRef.current += 1;
    return idCounterRef.current;
  }, []);

  const commitConversation = React.useCallback((turns: ConversationTurn[]) => {
    const trimmed = turns.slice(-MAX_DISPLAY_MESSAGES);
    conversationRef.current = trimmed;
    setConversation(trimmed);
  }, []);

  /* ---------------------------- Send message ---------------------------- */

  const handleSendMessage = React.useCallback(
    async (rawText: string) => {
      const text = rawText.trim();

      if (!text || isLoadingRef.current) return;

      if (text.length > MAX_MESSAGE_LENGTH) {
        toast({
          variant: 'destructive',
          title: 'Message too long',
          description: `Please keep your message under ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`,
        });
        return;
      }

      const sessionId = sessionIdRef.current;
      const before = conversationRef.current;
      const userTurn: ConversationTurn = { id: nextId(), role: 'user', content: text };

      commitConversation([...before, userTurn]);
      setInput('');
      setIsLoading(true);
      isLoadingRef.current = true;

      onMessageSentRef.current();

      // Private mode sends no history at all.
      const history = privateModeRef.current ? [] : buildHistory(before);

      const rollback = () => {
        // Restore the conversation and the user's text so retrying is one tap.
        commitConversation(before);
        setInput(text);
      };

      try {
        const result = await handleChatbot({
          userInput: text,
          targetLanguage: getLanguageName(targetLangRef.current),
          history,
        });

        if (!mountedRef.current || sessionId !== sessionIdRef.current) return;

        if (result.success) {
          const response = result.response.trim();

          if (!response) {
            rollback();
            toast({
              variant: 'destructive',
              title: 'Chatbot Error',
              description: 'The tutor returned an empty response. Please try again.',
            });
            return;
          }

          commitConversation([
            ...conversationRef.current,
            { id: nextId(), role: 'assistant', content: response },
          ]);
          return;
        }

        rollback();
        toast({
          variant: 'destructive',
          title: 'Chatbot Error',
          description: result.error || 'The chatbot failed to respond. Please try again.',
        });
      } catch (error: unknown) {
        if (!mountedRef.current || sessionId !== sessionIdRef.current) return;

        console.error('[ChatbotTutor] Failed to send message.', error);

        rollback();
        toast({
          variant: 'destructive',
          title: 'Chatbot Error',
          description: 'Something went wrong while contacting the tutor. Please try again.',
        });
      } finally {
        // A stale request must not reset a newer conversation's loading state.
        if (mountedRef.current && sessionId === sessionIdRef.current) {
          setIsLoading(false);
          isLoadingRef.current = false;
        }
      }
    },
    [commitConversation, nextId, toast],
  );

  // Speech recognition calls the latest handler without being recreated.
  const sendRef = React.useRef(handleSendMessage);
  React.useEffect(() => {
    sendRef.current = handleSendMessage;
  }, [handleSendMessage]);

  /* --------------- Reset conversation (language or privacy change) -------- */

  // The greeting is local: no AI call, no credits and no rate-limit usage.
  React.useEffect(() => {
    sessionIdRef.current += 1;
    isLoadingRef.current = false;
    setIsLoading(false);
    setInput('');

    try {
      recognitionRef.current?.abort();
    } catch {
      // Recognition may already have ended.
    }

    commitConversation([
      {
        id: nextId(),
        role: 'assistant',
        isLocal: true,
        content: isPrivate
          ? `Private session started in ${targetLanguageName}. History will not be saved.`
          : `Hi! I'm Kai, your ${targetLanguageName} tutor. Write or say something in ${targetLanguageName} and I'll help you practice.`,
      },
    ]);
  }, [isPrivate, targetLanguageName, commitConversation, nextId]);

  /* ------------------------------ Auto-scroll --------------------------- */

  React.useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation, isLoading]);

  /* ----------------------- Speech recognition setup ---------------------- */

  React.useEffect(() => {
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionClass =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setIsSpeechSupported(false);
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = targetLang;

    recognition.onstart = () => {
      if (mountedRef.current) setIsListening(true);
    };

    recognition.onresult = (event) => {
      if (!mountedRef.current) return;

      const spokenText = event.results[event.resultIndex]?.[0]?.transcript?.trim();
      if (!spokenText) return;

      void sendRef.current(spokenText);
    };

    recognition.onerror = (event) => {
      if (!mountedRef.current) return;

      setIsListening(false);

      // "no-speech" is normal when the user stays silent.
      if (event.error === 'no-speech' || event.error === 'aborted') return;

      let description = 'Speech recognition failed. Please try again.';

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
            'Speech recognition needs a network connection. Please check your connection and try again.';
          break;
        case 'language-not-supported':
          description =
            'Speech recognition is not available for this language in your current browser.';
          break;
        default:
          break;
      }

      toast({ variant: 'destructive', title: 'Speech Error', description });
    };

    recognition.onend = () => {
      if (mountedRef.current) setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsSpeechSupported(true);

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;

      try {
        recognition.abort();
      } catch {
        // Recognition may already have ended.
      }

      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };
  }, [targetLang, toast]);

  /* ------------------------------- Mic button ---------------------------- */

  const handleListen = React.useCallback(() => {
    const recognition = recognitionRef.current;

    if (!recognition || !isSpeechSupported) {
      toast({
        variant: 'destructive',
        title: 'Speech recognition unavailable',
        description: 'Your current browser does not support speech recognition.',
      });
      return;
    }

    if (isLoadingRef.current) return;

    if (isListening) {
      try {
        recognition.stop();
      } catch {
        // Already stopped.
      }
      return;
    }

    try {
      // start() asks for microphone permission itself. Opening a separate
      // getUserMedia stream is unnecessary and can break recognition on some
      // Android browsers.
      recognition.lang = targetLang;
      recognition.start();
    } catch (error: unknown) {
      console.error('[ChatbotTutor] Could not start speech recognition.', error);

      toast({
        variant: 'destructive',
        title: 'Microphone Error',
        description: 'Could not start speech recognition. Please try again.',
      });
    }
  }, [isListening, isSpeechSupported, targetLang, toast]);

  /* ------------------------------ Form handling -------------------------- */

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleSendMessage(input);
    },
    [handleSendMessage, input],
  );

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void handleSendMessage(input);
      }
    },
    [handleSendMessage, input],
  );

  const handleSpeak = React.useCallback(
    (text: string) => {
      void speak({ text, lang: targetLang });
    },
    [speak, targetLang],
  );

  /* -------------------------------- Cleanup ------------------------------ */

  React.useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      sessionIdRef.current += 1;

      try {
        recognitionRef.current?.abort();
      } catch {
        // Ignore browser cleanup errors.
      }

      recognitionRef.current = null;
    };
  }, []);

  /* -------------------------------- Render ------------------------------- */

  return (
    <Card className="flex h-[65vh] w-full flex-col">
      <ScrollArea className="flex-1 p-4">
        <div
          className="space-y-6"
          aria-live="polite"
          aria-label="Language tutor conversation"
        >
          {conversation.map((turn) => (
            <MessageBubble
              key={turn.id}
              turn={turn}
              onSpeak={handleSpeak}
              speakDisabled={isSpeaking}
            />
          ))}

          {isLoading && (
            <div
              className="flex items-start gap-3"
              role="status"
              aria-label="Tutor is typing"
            >
              <Avatar className="shrink-0">
                <AvatarFallback>
                  <Bot className="h-5 w-5" aria-hidden="true" />
                </AvatarFallback>
              </Avatar>

              <div className="rounded-lg bg-muted p-3">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              </div>
            </div>
          )}

          <div ref={scrollAnchorRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
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
              variant={isListening ? 'destructive' : 'outline'}
              onClick={handleListen}
              disabled={!isSpeechSupported || isLoading}
              aria-label={isListening ? 'Stop listening' : 'Start voice input'}
              title={
                isSpeechSupported
                  ? isListening
                    ? 'Stop listening'
                    : 'Speak'
                  : 'Speech recognition is not supported'
              }
            >
              {isListening ? <VoiceVisualizer /> : <Mic className="h-5 w-5" aria-hidden="true" />}
            </Button>

            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
              title="Send message"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-5 w-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </form>

        <div
          id="chatbot-input-hint"
          className="mt-2 flex justify-between text-xs text-muted-foreground"
        >
          <span>Press Enter to send · Shift + Enter for a new line</span>

          <span aria-live="polite" className="tabular-nums">
            {input.length.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}
          </span>
        </div>
      </div>
    </Card>
  );
});