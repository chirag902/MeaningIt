'use client';

import * as React from 'react';
import {Mic, Loader2, User, Bot, Languages} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useToast} from '@/hooks/use-toast';
import {handleTranslation, handleTextToSpeech} from '@/app/actions';
import {languages} from '@/lib/languages';
import {Card, CardContent} from './ui/card';
import {VoiceVisualizer} from './voice-visualizer';

interface LiveTranslatorProps {
  lang1: string;
  lang2: string;
}

type Speaker = 'user1' | 'user2';
type ConversationTurn = {
  speaker: Speaker;
  originalText: string;
  translatedText: string;
  audioUrl?: string;
};

export const LiveTranslator = React.memo(function LiveTranslator({lang1, lang2}: LiveTranslatorProps) {
  const [conversation, setConversation] = React.useState<ConversationTurn[]>([]);
  const [isListening, setIsListening] = React.useState<Speaker | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [audioStream, setAudioStream] = React.useState<MediaStream | null>(null);

  const {toast} = useToast();
  const recognitionRef = React.useRef<SpeechRecognition | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const conversationEndRef = React.useRef<HTMLDivElement | null>(null);

  const stopAudioStream = React.useCallback(() => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }
  }, [audioStream]);

  React.useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        variant: 'destructive',
        title: 'Not Supported',
        description: 'Speech recognition is not supported in your browser.',
      });
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onstart = () => {};
    recognitionRef.current.onend = () => {
      setIsListening(null);
      stopAudioStream();
    };

    recognitionRef.current.onerror = event => {
      toast({
        variant: 'destructive',
        title: 'Speech Error',
        description: `Error occurred in recognition: ${event.error}`,
      });
      setIsListening(null);
      stopAudioStream();
    };

    recognitionRef.current.onresult = async event => {
      if (!isListening) return;

      const spokenText = event.results[0][0].transcript;
      setIsProcessing(true);

      const sourceLangCode = isListening === 'user1' ? lang1 : lang2;
      const targetLangCode = isListening === 'user1' ? lang2 : lang1;

      const translationResult = await handleTranslation({
        text: spokenText,
        sourceLanguage: languages.find(l => l.code === sourceLangCode)?.name || 'English',
        targetLanguage: languages.find(l => l.code === targetLangCode)?.name || 'Spanish',
      });

      if (translationResult.success && translationResult.translation) {
        const ttsResult = await handleTextToSpeech({
          text: translationResult.translation,
          languageCode: targetLangCode,
        });

        const newTurn: ConversationTurn = {
          speaker: isListening,
          originalText: spokenText,
          translatedText: translationResult.translation,
          audioUrl: ttsResult.success ? ttsResult.audioDataUri : undefined,
        };

        setConversation(prev => [...prev, newTurn]);

        if (ttsResult.success && ttsResult.audioDataUri && audioRef.current) {
          audioRef.current.src = ttsResult.audioDataUri;
          audioRef.current.play().catch(e => console.error('Audio playback failed', e));
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Translation Error',
          description: translationResult.error || 'Could not translate the speech.',
        });
      }
      setIsProcessing(false);
    };
  }, [toast, lang1, lang2, isListening, stopAudioStream]);

  React.useEffect(() => {
    conversationEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [conversation]);

  React.useEffect(() => {
    return () => {
      stopAudioStream();
    };
  }, [stopAudioStream]);

  const handleToggleListen = async (speaker: Speaker) => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              noiseSuppression: true,
              echoCancellation: true,
            },
          });
          setAudioStream(stream);
          recognitionRef.current.lang = speaker === 'user1' ? lang1 : lang2;
          recognitionRef.current.start();
          setIsListening(speaker);
        } catch (error) {
          console.error('Microphone access error:', error);
          toast({
            variant: 'destructive',
            title: 'Microphone Error',
            description: 'Could not access the microphone. Please check your browser permissions.',
          });
        }
      }
    }
  };

  const getLangName = (code: string) => languages.find(l => l.code === code)?.name || code;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Speaker 1 */}
        <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-background/50">
          <div className="flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">{getLangName(lang1)}</span>
          </div>
          <Button
            onClick={() => handleToggleListen('user1')}
            disabled={isProcessing || (isListening !== null && isListening !== 'user1')}
            size="lg"
            className="rounded-full w-20 h-20"
          >
            {isListening === 'user1' ? <VoiceVisualizer /> : <Mic className="h-8 w-8" />}
          </Button>
          <p className="text-sm text-muted-foreground h-4">{isListening === 'user1' ? 'Listening...' : 'Tap to speak'}</p>
        </div>

        {/* Speaker 2 */}
        <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-background/50">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-accent" />
            <span className="font-semibold text-lg">{getLangName(lang2)}</span>
          </div>
          <Button
            onClick={() => handleToggleListen('user2')}
            disabled={isProcessing || (isListening !== null && isListening !== 'user2')}
            size="lg"
            className="rounded-full w-20 h-20"
            variant="secondary"
          >
            {isListening === 'user2' ? <VoiceVisualizer /> : <Mic className="h-8 w-8" />}
          </Button>
          <p className="text-sm text-muted-foreground h-4">{isListening === 'user2' ? 'Listening...' : 'Tap to speak'}</p>
        </div>
      </div>

      <div className="mt-4 space-y-4 max-h-[40vh] overflow-y-auto p-4 border rounded-lg">
        {isProcessing && conversation.length === 0 && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4">Translating...</p>
          </div>
        )}
        {conversation.map((turn, index) => (
          <Card key={index} className={turn.speaker === 'user1' ? 'bg-primary/10' : 'bg-accent/10'}>
            <CardContent className="p-4">
              <p className="font-semibold text-sm text-muted-foreground">
                {turn.speaker === 'user1' ? getLangName(lang1) : getLangName(lang2)} said:
              </p>
              <p className="italic">"{turn.originalText}"</p>
              <p className="font-semibold text-sm text-muted-foreground mt-2">
                Translated to {turn.speaker === 'user1' ? getLangName(lang2) : getLangName(lang1)}:
              </p>
              <p className="text-lg font-bold">{turn.translatedText}</p>
            </CardContent>
          </Card>
        ))}
        {!isProcessing && conversation.length === 0 && (
          <div className="text-center text-muted-foreground p-8 flex flex-col items-center gap-4">
            <Languages className="h-12 w-12" />
            <p>Start a conversation by tapping one of the microphones above.</p>
          </div>
        )}
        <div ref={conversationEndRef} />
      </div>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
});
