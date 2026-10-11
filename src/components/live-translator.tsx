'use client';

import * as React from 'react';
import { Mic, Loader2, User, Bot, Languages, Square, Volume2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { handleTranslation } from '@/app/actions';
import { languages } from '@/lib/languages';
import { useSpeak } from '@/hooks/use-speak';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { Card, CardContent } from './ui/card';
import { VoiceVisualizer } from './voice-visualizer';

interface LiveTranslatorProps {
  lang1: string;
  lang2: string;
}

type Speaker = 'user1' | 'user2';

// Each turn stores its own languages, so history and "play" stay correct
// even after the user changes the language selection.
type ConversationTurn = {
  id: number;
  speaker: Speaker;
  originalText: string;
  translatedText: string;
  spokenLanguageName: string;
  targetLanguageName: string;
  targetLanguageCode: string;
};

const MAX_CONVERSATION_TURNS = 50;
const MAX_SPOKEN_TEXT_LENGTH = 2_000;

function getLanguageName(code: string): string {
  return languages.find((language) => language.code === code)?.name ?? code;
}

/* -------------------------------------------------------------------------- */
/* Subcomponents                                                              */
/* -------------------------------------------------------------------------- */

interface SpeakerPanelProps {
  speaker: Speaker;
  langCode: string;
  isActive: boolean;
  disabled: boolean;
  onToggle: (speaker: Speaker) => void;
}

const SpeakerPanel = React.memo(function SpeakerPanel({
  speaker,
  langCode,
  isActive,
  disabled,
  onToggle,
}: SpeakerPanelProps) {
  const number = speaker === 'user1' ? 1 : 2;
  const name = getLanguageName(langCode);

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-lg border bg-background/50 p-4"
      aria-label={`Speaker ${number} - ${name}`}
    >
      <div className="flex items-center gap-2">
        {speaker === 'user1' ? (
          <User className="h-6 w-6 text-primary" aria-hidden="true" />
        ) : (
          <Bot className="h-6 w-6 text-accent" aria-hidden="true" />
        )}

        <span className="text-lg font-semibold">{name}</span>
      </div>

      <Button
        type="button"
        onClick={() => onToggle(speaker)}
        disabled={disabled}
        size="lg"
        className="h-20 w-20 rounded-full"
        variant={speaker === 'user1' ? 'default' : 'secondary'}
        aria-label={
          isActive ? `Stop listening for speaker ${number}` : `Start listening for speaker ${number}`
        }
        title={isActive ? 'Stop listening' : 'Tap to speak'}
      >
        {isActive ? <VoiceVisualizer /> : <Mic className="h-8 w-8" aria-hidden="true" />}
      </Button>

      <p className="h-4 text-sm text-muted-foreground">
        {isActive ? 'Listening...' : langCode === 'auto' ? 'Select a language' : 'Tap to speak'}
      </p>
    </div>
  );
});

interface TurnCardProps {
  turn: ConversationTurn;
  onPlay: (turn: ConversationTurn) => void;
}

const TurnCard = React.memo(function TurnCard({ turn, onPlay }: TurnCardProps) {
  return (
    <Card className={turn.speaker === 'user1' ? 'bg-primary/10' : 'bg-accent/10'}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-muted-foreground">
              {turn.spokenLanguageName} said:
            </p>

            <p className="mt-1 break-words italic">“{turn.originalText}”</p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => onPlay(turn)}
            aria-label="Play translation"
            title="Play translation"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <p className="mt-3 text-sm font-semibold text-muted-foreground">
          Translated to {turn.targetLanguageName}:
        </p>

        <p className="mt-1 break-words text-lg font-bold">{turn.translatedText}</p>
      </CardContent>
    </Card>
  );
});

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export const LiveTranslator = React.memo(function LiveTranslator({
  lang1,
  lang2,
}: LiveTranslatorProps) {
  const { toast } = useToast();
  const { speak } = useSpeak();

  const [conversation, setConversation] = React.useState<ConversationTurn[]>([]);
  const [activeSpeaker, setActiveSpeaker] = React.useState<Speaker | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const mountedRef = React.useRef(true);
  const requestIdRef = React.useRef(0);
  const idCounterRef = React.useRef(0);
  const isProcessingRef = React.useRef(false);
  const activeSpeakerRef = React.useRef<Speaker | null>(null);
  const conversationEndRef = React.useRef<HTMLDivElement | null>(null);

  // Latest values for async code, without recreating callbacks.
  const lang1Ref = React.useRef(lang1);
  const lang2Ref = React.useRef(lang2);
  const toastRef = React.useRef(toast);
  const speakRef = React.useRef(speak);

  React.useEffect(() => {
    lang1Ref.current = lang1;
    lang2Ref.current = lang2;
    toastRef.current = toast;
    speakRef.current = speak;
  });

  /* ------------------------------ Translation ---------------------------- */

  const translateSpeech = React.useCallback(async (spokenText: string, speaker: Speaker) => {
    const text = spokenText.trim();
    if (!text) return;

    const sourceCode = speaker === 'user1' ? lang1Ref.current : lang2Ref.current;
    const targetCode = speaker === 'user1' ? lang2Ref.current : lang1Ref.current;

    if (sourceCode === 'auto' || targetCode === 'auto') {
      toastRef.current({
        variant: 'destructive',
        title: 'Select a language',
        description: 'Live translation requires a specific source and target language.',
      });
      return;
    }

    const sourceName = getLanguageName(sourceCode);
    const targetName = getLanguageName(targetCode);

    const requestId = ++requestIdRef.current;
    setIsProcessing(true);
    isProcessingRef.current = true;

    try {
      const result = await handleTranslation({
        text,
        sourceLanguage: sourceName,
        targetLanguage: targetName,
        isSpeedBoosted: true,
      });

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      if (!result.success) {
        toastRef.current({
          variant: 'destructive',
          title: 'Translation Error',
          description: result.error || 'Could not translate the speech. Please try again.',
        });
        return;
      }

      const translated = result.translation.trim();

      if (!translated) {
        toastRef.current({
          variant: 'destructive',
          title: 'Translation Error',
          description: 'The translation came back empty. Please try again.',
        });
        return;
      }

      idCounterRef.current += 1;

      const turn: ConversationTurn = {
        id: idCounterRef.current,
        speaker,
        originalText: text,
        translatedText: translated,
        spokenLanguageName: sourceName,
        targetLanguageName: targetName,
        targetLanguageCode: targetCode,
      };

      setConversation((previous) => [...previous, turn].slice(-MAX_CONVERSATION_TURNS));

      // Not awaited: the microphone stays usable while the translation is read aloud.
      void speakRef.current({ text: translated, lang: targetCode });
    } catch (error: unknown) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      console.error('[LiveTranslator] Translation failed.', error);

      toastRef.current({
        variant: 'destructive',
        title: 'Translation Error',
        description: 'Something went wrong while translating the speech. Please try again.',
      });
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setIsProcessing(false);
        isProcessingRef.current = false;
      }
    }
  }, []);

  /* ------------------------------ Speech input --------------------------- */

  const handleSpeechResult = React.useCallback(
    (spokenText: string) => {
      const speaker = activeSpeakerRef.current;
      if (!speaker) return;

      if (spokenText.length > MAX_SPOKEN_TEXT_LENGTH) {
        toastRef.current({
          variant: 'destructive',
          title: 'Speech too long',
          description: 'Please speak a shorter sentence and try again.',
        });
        return;
      }

      void translateSpeech(spokenText, speaker);
    },
    [translateSpeech],
  );

  const {
    isSupported: isSpeechSupported,
    isListening,
    start: startListening,
    stop: stopListening,
    abort: abortListening,
  } = useSpeechRecognition({ onResult: handleSpeechResult });

  const listeningSpeaker: Speaker | null = isListening ? activeSpeaker : null;

  // A language change during listening would leave recognition on the old language.
  React.useEffect(() => {
    abortListening();
  }, [lang1, lang2, abortListening]);

  const handleToggleListen = React.useCallback(
    (speaker: Speaker) => {
      if (isProcessingRef.current) return;

      if (isListening) {
        if (activeSpeakerRef.current === speaker) stopListening();
        return;
      }

      const code = speaker === 'user1' ? lang1Ref.current : lang2Ref.current;

      if (!code || code === 'auto') {
        toastRef.current({
          variant: 'destructive',
          title: 'Select a language',
          description: `Please select a specific language for ${
            speaker === 'user1' ? 'Speaker 1' : 'Speaker 2'
          } before starting voice input.`,
        });
        return;
      }

      activeSpeakerRef.current = speaker;
      setActiveSpeaker(speaker);

      if (!startListening(code)) {
        activeSpeakerRef.current = null;
        setActiveSpeaker(null);
      }
    },
    [isListening, startListening, stopListening],
  );

  /* ------------------------------ Other handlers ------------------------- */

  const handlePlayTurn = React.useCallback((turn: ConversationTurn) => {
    void speakRef.current({ text: turn.translatedText, lang: turn.targetLanguageCode });
  }, []);

  const clearConversation = React.useCallback(() => {
    abortListening();

    requestIdRef.current += 1;
    setConversation([]);
    setIsProcessing(false);
    isProcessingRef.current = false;
  }, [abortListening]);

  /* ------------------------------ Lifecycle ------------------------------ */

  React.useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation, isProcessing]);

  React.useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  /* -------------------------------- Render ------------------------------- */

  const busy = isProcessing;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        <SpeakerPanel
          speaker="user1"
          langCode={lang1}
          isActive={listeningSpeaker === 'user1'}
          disabled={!isSpeechSupported || busy || (isListening && listeningSpeaker !== 'user1')}
          onToggle={handleToggleListen}
        />

        <SpeakerPanel
          speaker="user2"
          langCode={lang2}
          isActive={listeningSpeaker === 'user2'}
          disabled={!isSpeechSupported || busy || (isListening && listeningSpeaker !== 'user2')}
          onToggle={handleToggleListen}
        />
      </div>

      {/* Conversation history */}
      <div className="mt-4 overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="font-semibold">Live Translation</h2>
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
          {conversation.map((turn) => (
            <TurnCard key={turn.id} turn={turn} onPlay={handlePlayTurn} />
          ))}

          {isProcessing && (
            <div
              className="flex items-center justify-center gap-3 rounded-lg bg-muted/40 p-6"
              role="status"
              aria-label="Translating speech"
            >
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm font-medium">Translating...</p>
            </div>
          )}

          {!isProcessing && conversation.length === 0 && (
            <div className="flex flex-col items-center gap-4 p-8 text-center text-muted-foreground">
              <Languages className="h-12 w-12" aria-hidden="true" />

              <div>
                <p className="font-medium">Start a live conversation</p>
                <p className="mt-1 text-sm">
                  Tap either microphone and speak. Your speech will be translated into the other
                  selected language.
                </p>
              </div>

              {(lang1 === 'auto' || lang2 === 'auto') && (
                <p className="text-sm text-destructive">
                  Please select specific languages for both speakers before starting.
                </p>
              )}

              {!isSpeechSupported && (
                <p className="text-sm text-destructive">
                  Speech recognition is not supported by your current browser.
                </p>
              )}
            </div>
          )}

          <div ref={conversationEndRef} />
        </div>
      </div>

      {listeningSpeaker && (
        <div
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <VoiceVisualizer />

          <span>
            Listening for {getLanguageName(listeningSpeaker === 'user1' ? lang1 : lang2)}...
          </span>

          <Button type="button" variant="ghost" size="sm" onClick={abortListening}>
            <Square className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Stop
          </Button>
        </div>
      )}
    </div>
  );
});