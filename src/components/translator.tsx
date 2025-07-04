'use client';

import * as React from 'react';
import { ArrowRightLeft, Copy, Loader2, Mic, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { languages } from '@/lib/languages';
import { handleTranslation } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { VoiceVisualizer } from './voice-visualizer';

export function Translator() {
  const [sourceLang, setSourceLang] = React.useState('en-US');
  const [targetLang, setTargetLang] = React.useState('es-ES');
  const [sourceText, setSourceText] = React.useState('');
  const [translatedText, setTranslatedText] = React.useState('');
  const [isTranslating, setIsTranslating] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  
  const { toast } = useToast();
  const recognitionRef = React.useRef<SpeechRecognition | null>(null);
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  const performTranslation = React.useCallback(async () => {
    if (sourceText.trim() === '') {
      setTranslatedText('');
      return;
    }
    setIsTranslating(true);
    const result = await handleTranslation({
      text: sourceText,
      sourceLanguage: languages.find(l => l.code === sourceLang)?.name || 'English',
      targetLanguage: languages.find(l => l.code === targetLang)?.name || 'Spanish',
    });
    if (result.success) {
      setTranslatedText(result.translation);
    } else {
      toast({
        variant: 'destructive',
        title: 'Translation Error',
        description: result.error,
      });
    }
    setIsTranslating(false);
  }, [sourceText, sourceLang, targetLang, toast]);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performTranslation();
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sourceText, sourceLang, targetLang, performTranslation]);

  React.useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = sourceLang;
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event) => setSourceText(event.results[0][0].transcript);
      recognition.onerror = (event) => {
        toast({
          variant: 'destructive',
          title: 'Speech Error',
          description: `Error occurred in recognition: ${event.error}`,
        });
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    } else {
        console.warn("Speech recognition not supported in this browser.");
    }
  }, [sourceLang, toast]);

  const handleSwapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(translatedText).then(() => {
      toast({ title: 'Copied to clipboard!' });
    });
  };

  const handleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(translatedText);
      utterance.lang = targetLang;
      window.speechSynthesis.speak(utterance);
    } else {
        toast({
            variant: "destructive",
            title: "Not Supported",
            description: "Your browser does not support text-to-speech."
        })
    }
  };

  return (
    <Card className="w-full max-w-4xl shadow-2xl">
      <CardHeader className="border-b">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Select value={sourceLang} onValueChange={setSourceLang}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Source Language" />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="icon" onClick={handleSwapLanguages} className="flex-shrink-0">
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          </Button>

          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Target Language" />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <Textarea
              placeholder="Enter text to translate..."
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              className="h-48 resize-none text-base"
            />
            <div className="flex items-center justify-between">
              <Button onClick={handleListen} variant="outline" size="icon" disabled={!recognitionRef.current}>
                <Mic className={`h-5 w-5 ${isListening ? 'text-destructive' : ''}`} />
              </Button>
              {isListening && <VoiceVisualizer />}
            </div>
          </div>

          <div className="flex flex-col gap-4 relative">
            <Textarea
              placeholder="Translation"
              value={translatedText}
              readOnly
              className="h-48 resize-none bg-muted/50 text-base"
            />
            <div className="flex items-center space-x-2">
              <Button onClick={handleCopyToClipboard} variant="outline" size="icon" disabled={!translatedText}>
                <Copy className="h-5 w-5" />
              </Button>
              <Button onClick={handleSpeak} variant="outline" size="icon" disabled={!translatedText}>
                <Volume2 className="h-5 w-5" />
              </Button>
            </div>
             {isTranslating && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-md">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
