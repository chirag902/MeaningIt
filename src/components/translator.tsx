'use client';

import * as React from 'react';
import { ArrowRightLeft, Copy, Loader2, Mic, Volume2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { languages } from '@/lib/languages';
import { handleTranslation } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { VoiceVisualizer } from './voice-visualizer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageTranslator } from './image-translator';
import { LiveTranslator } from './live-translator';

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

  const performTranslation = React.useCallback(async (textToTranslate: string) => {
    if (textToTranslate.trim() === '') {
      setTranslatedText('');
      return;
    }
    setIsTranslating(true);
    const result = await handleTranslation({
      text: textToTranslate,
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
  }, [sourceLang, targetLang, toast]);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if(sourceText.trim().length > 0) {
        debounceRef.current = setTimeout(() => {
          performTranslation(sourceText);
        }, 500);
    } else {
        setTranslatedText('');
    }
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
      recognition.onresult = (event) => {
          const newText = event.results[0][0].transcript;
          setSourceText(newText);
      };
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
    performTranslation(translatedText);
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
    <Card className="w-full max-w-4xl shadow-2xl bg-card/80 backdrop-blur-sm">
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
      <CardContent className="p-0 sm:p-6">
       <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 m-0 rounded-none border-b">
            <TabsTrigger value="text" className="py-4 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Text</TabsTrigger>
            <TabsTrigger value="image" className="py-4 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Image</TabsTrigger>
            <TabsTrigger value="live" className="py-4 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Live</TabsTrigger>
        </TabsList>
        <TabsContent value="text" className="p-6">
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
        </TabsContent>
        <TabsContent value="image" className="p-6">
            <ImageTranslator targetLang={targetLang} />
        </TabsContent>
        <TabsContent value="live" className="p-6">
            <LiveTranslator lang1={sourceLang} lang2={targetLang} />
        </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
