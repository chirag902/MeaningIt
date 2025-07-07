'use client';

import * as React from 'react';
import { ArrowRightLeft, Copy, Loader2, Mic, Volume2, Camera, Info, Lightbulb, BrainCircuit } from 'lucide-react';
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
import { ChatbotTutor } from './chatbot-tutor';

export function Translator() {
  const [sourceLang, setSourceLang] = React.useState('auto');
  const [targetLang, setTargetLang] = React.useState('es-ES');
  const [sourceText, setSourceText] = React.useState('');
  const [translatedText, setTranslatedText] = React.useState('');
  const [detectedLangName, setDetectedLangName] = React.useState<string | null>(null);
  const [isTranslating, setIsTranslating] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [audioStream, setAudioStream] = React.useState<MediaStream | null>(null);
  const [toneAnalysis, setToneAnalysis] = React.useState<string | null>(null);
  const [toneSuggestions, setToneSuggestions] = React.useState<string[]>([]);
  
  const { toast } = useToast();
  const recognitionRef = React.useRef<SpeechRecognition | null>(null);
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  const performTranslation = React.useCallback(async (textToTranslate: string) => {
    if (textToTranslate.trim() === '') {
      setTranslatedText('');
      setDetectedLangName(null);
      setToneAnalysis(null);
      setToneSuggestions([]);
      return;
    }
    setIsTranslating(true);
    const result = await handleTranslation({
      text: textToTranslate,
      sourceLanguage: sourceLang === 'auto' ? 'auto' : languages.find(l => l.code === sourceLang)?.name || 'English',
      targetLanguage: languages.find(l => l.code === targetLang)?.name || 'Spanish',
    });
    if (result.success) {
      setTranslatedText(result.translation);
      setDetectedLangName(result.detectedLanguageName || null);
      setToneAnalysis(result.toneAnalysis || null);
      setToneSuggestions(result.suggestions || []);
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
        setDetectedLangName(null);
        setToneAnalysis(null);
        setToneSuggestions([]);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sourceText, sourceLang, targetLang, performTranslation]);

  const stopAudioStream = React.useCallback(() => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }
  }, [audioStream]);

  React.useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = sourceLang === 'auto' ? 'en-US' : sourceLang; // Default recognition lang if auto
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => {
          setIsListening(false);
          stopAudioStream();
      };
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
        stopAudioStream();
      };
      recognitionRef.current = recognition;
    } else {
        console.warn("Speech recognition not supported in this browser.");
    }
    
    return () => {
        stopAudioStream();
    }
  }, [sourceLang, toast, stopAudioStream]);

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto') {
        toast({ title: "Can't swap from Auto-detect", description: "Please select a specific language to swap." });
        return;
    }
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

  const handleListen = async () => {
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
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error enabling voice clarity features:', error);
          toast({
            variant: 'destructive',
            title: 'Microphone Error',
            description: 'Could not enable voice clarity. Please check permissions.',
          });
          // Fallback to start listening
          recognitionRef.current.start();
        }
      }
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
          <Select value={sourceLang} onValueChange={(value) => { setSourceLang(value); setDetectedLangName(null); }}>
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

          <Button variant="ghost" size="icon" onClick={handleSwapLanguages} className="flex-shrink-0" disabled={sourceLang === 'auto'}>
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          </Button>

          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Target Language" />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                 lang.code !== 'auto' && <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
       <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-transparent p-0 m-0 rounded-none border-b">
            <TabsTrigger value="text" className="py-4 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Text</TabsTrigger>
            <TabsTrigger value="image" className="py-4 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Image</TabsTrigger>
            <TabsTrigger value="live" className="py-4 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Live</TabsTrigger>
            <TabsTrigger value="tutor" className="py-4 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Tutor</TabsTrigger>
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
                <div className="flex items-center justify-between h-10">
                    <div className="flex items-center gap-4">
                        <Button onClick={handleListen} variant="outline" size="icon" disabled={!recognitionRef.current}>
                            <Mic className={`h-5 w-5 ${isListening ? 'text-destructive' : ''}`} />
                        </Button>
                        {isListening ? (
                            <VoiceVisualizer />
                        ) : (
                            sourceLang === 'auto' && detectedLangName && (
                                <div className="text-sm text-muted-foreground">
                                    Detected: <span className="font-medium text-foreground">{detectedLangName}</span>
                                </div>
                            )
                        )}
                    </div>
                </div>
                 {toneAnalysis && (
                  <Card className="p-3 bg-muted/30 border-dashed">
                    <CardContent className="p-0">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-sm">Tone Analysis</p>
                          <p className="text-sm text-muted-foreground">{toneAnalysis}</p>
                        </div>
                      </div>
                      {toneSuggestions && toneSuggestions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-dashed">
                           <div className="flex items-start gap-3">
                             <Lightbulb className="h-5 w-5 mt-0.5 text-amber-500 flex-shrink-0" />
                             <div>
                                <p className="font-semibold text-sm">Suggestions</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {toneSuggestions.map((suggestion, index) => (
                                    <Button
                                      key={index}
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSourceText(suggestion)}
                                      className="text-xs h-auto py-1 px-2 bg-background hover:bg-muted"
                                    >
                                      {suggestion}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                           </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
            </div>

            <div className="flex flex-col gap-4 relative">
                <Textarea
                placeholder="Translation"
                value={translatedText}
                readOnly
                className="h-48 resize-none bg-muted/50 text-base"
                />
                <div className="flex items-center space-x-2 h-10">
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
        <TabsContent value="tutor" className="p-6">
            <ChatbotTutor targetLang={targetLang} />
        </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
