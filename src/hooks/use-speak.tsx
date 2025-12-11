'use client';

import { useState, useCallback, useEffect } from 'react';
import { useToast } from './use-toast';
import { handleTextToSpeech } from '@/app/actions';
import React from 'react';

interface SpeakProps {
  text: string;
  lang: string;
}

export const useSpeak = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { toast } = useToast();
  const audioRef = React.useRef<HTMLAudioElement | null>(null);


  const speak = useCallback(
    async ({ text, lang }: SpeakProps) => {
      if (!text || text.trim() === '') return;

      setIsSpeaking(true);

      try {
        // 1. Try server-side TTS first
        const result = await handleTextToSpeech({ text, languageCode: lang });

        if (result.success && result.audioDataUri) {
          // If we have server audio, play it
          if (audioRef.current) {
            audioRef.current.pause();
          }
          const audio = new Audio(result.audioDataUri);
          audioRef.current = audio;
          audio.play();
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => {
            toast({
              variant: 'destructive',
              title: 'Playback Error',
              description: 'Could not play the generated audio.',
            });
            setIsSpeaking(false);
          }
          return;
        }

        // 2. Fallback to client-side Web Speech API
        if (typeof window === 'undefined' || !window.speechSynthesis) {
          toast({
            variant: 'destructive',
            title: 'Playback Error',
            description: 'Text-to-speech is not supported in your browser.',
          });
          setIsSpeaking(false);
          return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;

        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang === lang);
        if (voice) {
          utterance.voice = voice;
        }
        
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (event) => {
          toast({
            variant: 'destructive',
            title: 'Playback Error',
            description: event.error || 'An unknown error occurred during speech synthesis.',
          });
          setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);

      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'TTS Error',
          description: error.message || 'The text-to-speech service failed.',
        });
        setIsSpeaking(false);
      }
    },
    [toast]
  );
  
  // Ensure voices are loaded for client-side fallback
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        const loadVoices = () => window.speechSynthesis.getVoices();
        loadVoices(); // Initial load
        window.speechSynthesis.onvoiceschanged = loadVoices; // If voices load async
    }
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
  }, []);

  return { speak, isSpeaking };
};
