'use client';

import * as React from 'react';
import { Send, Mic, Loader2, Bot, User, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { handleChatbot, handleTextToSpeech } from '@/app/actions';
import { languages } from '@/lib/languages';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { VoiceVisualizer } from './voice-visualizer';
import { cn } from '@/lib/utils';

interface ChatbotTutorProps {
  targetLang: string;
  onMessageSent: () => void;
  isPrivate: boolean;
}

type ConversationTurn = {
  role: 'user' | 'model';
  text: string;
};

export function ChatbotTutor({ targetLang, onMessageSent, isPrivate }: ChatbotTutorProps) {
  const { toast } = useToast();
  const getLangName = (code: string) => languages.find(l => l.code === code)?.name || code;
  
  const [conversation, setConversation] = React.useState<ConversationTurn[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [audioStream, setAudioStream] = React.useState<MediaStream | null>(null);

  const recognitionRef = React.useRef<SpeechRecognition | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = React.useRef<HTMLDivElement | null>(null);

  const stopAudioStream = React.useCallback(() => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }
  }, [audioStream]);

  // Initialize or reset conversation when target language changes
  React.useEffect(() => {
    const startConversation = async () => {
      setIsLoading(true);
      const targetLanguageName = getLangName(targetLang);
      // Don't send a real prompt if in private mode, just set a default message.
      if (isPrivate) {
        setConversation([{ role: 'model', text: `Private session started in ${targetLanguageName}. History will not be saved.` }]);
        setIsLoading(false);
        return;
      }
      
      const result = await handleChatbot({
        userInput: `Hi, please introduce yourself as my ${targetLanguageName} tutor.`,
        targetLanguage: targetLanguageName,
        history: [],
      });
      if (result.success && result.response) {
        setConversation([{ role: 'model', text: result.response }]);
      } else {
        setConversation([{ role: 'model', text: `Hello! I am Kai, your language tutor for ${targetLanguageName}. What would you like to talk about today?` }]);
        toast({
          variant: 'destructive',
          title: 'Chatbot Error',
          description: result.error || 'Could not start conversation.',
        });
      }
      setIsLoading(false);
    };
    startConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLang, isPrivate]);

  React.useEffect(() => {
    scrollAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation]);
  
  React.useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => {
        setIsListening(false);
        stopAudioStream();
      };
      recognition.onresult = (event) => {
        const spokenText = event.results[0][0].transcript;
        setInput(spokenText);
        handleSendMessage(spokenText);
      };
      recognition.onerror = (event) => {
        toast({ variant: 'destructive', title: 'Speech Error', description: `Error: ${event.error}` });
        setIsListening(false);
        stopAudioStream();
      };
      recognitionRef.current = recognition;
    }
  }, [toast, stopAudioStream]);

  const handleSendMessage = async (text: string) => {
    if (text.trim() === '' || isLoading) return;

    onMessageSent();
    const newUserMessage: ConversationTurn = { role: 'user', text };
    const currentConversation = [...conversation, newUserMessage];
    setConversation(currentConversation);
    setInput('');
    setIsLoading(true);

    const result = await handleChatbot({
      userInput: text,
      targetLanguage: getLangName(targetLang),
      history: isPrivate ? [] : conversation,
    });

    if (result.success && result.response) {
      const newBotMessage: ConversationTurn = { role: 'model', text: result.response };
      setConversation([...currentConversation, newBotMessage]);
    } else {
      toast({
        variant: 'destructive',
        title: 'Chatbot Error',
        description: result.error || 'The chatbot failed to respond.',
      });
    }
    setIsLoading(false);
  };

  const handleListen = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else if (recognitionRef.current) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: true, echoCancellation: true } });
            setAudioStream(stream);
            recognitionRef.current.lang = targetLang;
            recognitionRef.current.start();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Microphone Error', description: 'Could not access the microphone. Please check your browser permissions.'});
        }
    }
  };

  const handleSpeak = async (text: string) => {
    if (!text || !audioRef.current) return;
    const ttsResult = await handleTextToSpeech({ text, lang: targetLang });
    if (ttsResult.success && ttsResult.audioDataUri) {
      audioRef.current.src = ttsResult.audioDataUri;
      audioRef.current.play().catch(e => console.error("Audio playback failed", e));
    } else {
      toast({ variant: 'destructive', title: 'Playback Error', description: ttsResult.error });
    }
  };

  return (
    <Card className="flex flex-col h-[65vh] w-full">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {conversation.map((turn, index) => (
            <div key={index} className={cn('flex items-start gap-3', turn.role === 'user' ? 'justify-end' : '')}>
              {turn.role === 'model' && (
                <Avatar>
                  <AvatarFallback><Bot /></AvatarFallback>
                </Avatar>
              )}
              <div className={cn(
                'max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg relative group',
                turn.role === 'model' ? 'bg-muted' : 'bg-primary text-primary-foreground'
              )}>
                <p className="whitespace-pre-wrap">{turn.text}</p>
                {turn.role === 'model' && (
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        className="absolute -bottom-4 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleSpeak(turn.text)}
                    >
                        <Volume2 className="h-4 w-4" />
                    </Button>
                )}
              </div>
              {turn.role === 'user' && (
                <Avatar>
                  <AvatarFallback><User /></AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isLoading && conversation[conversation.length - 1]?.role === 'user' && (
             <div className="flex items-start gap-3">
                <Avatar>
                  <AvatarFallback><Bot /></AvatarFallback>
                </Avatar>
                <div className="bg-muted p-3 rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                </div>
            </div>
          )}
        </div>
        <div ref={scrollAreaRef} />
      </ScrollArea>
      <div className="p-4 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(input);
          }}
          className="flex items-center gap-2"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isPrivate ? `Private chat in ${getLangName(targetLang)}...` : `Practice your ${getLangName(targetLang)}...`}
            className="h-12 resize-none"
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(input);
                }
            }}
          />
           <Button type="button" size="icon" variant={isListening ? 'destructive' : 'outline'} onClick={handleListen} disabled={!recognitionRef.current || isLoading}>
            {isListening ? <VoiceVisualizer /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </div>
      <audio ref={audioRef} className="hidden" />
    </Card>
  );
}
