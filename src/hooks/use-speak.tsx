'use client';

import { useState, useCallback, useEffect } from 'react';
import { useToast } from './use-toast';

interface SpeakProps {
  text: string;
  lang: string;
}

export const useSpeak = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { toast } = useToast();

  const speak = useCallback(
    ({ text, lang }: SpeakProps) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        toast({
          variant: 'destructive',
          title: 'Playback Error',
          description: 'Text-to-speech is not supported in your browser.',
        });
        return;
      }
      
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;

      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang === lang);
      if (voice) {
        utterance.voice = voice;
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (event) => {
        setIsSpeaking(false);
        toast({
          variant: 'destructive',
          title: 'Playback Error',
          description: event.error || 'An unknown error occurred during speech synthesis.',
        });
      };
      
      window.speechSynthesis.speak(utterance);
    },
    [toast]
  );
  
  // Ensure voices are loaded.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.getVoices();
    }
  }, []);

  return { speak, isSpeaking };
};
