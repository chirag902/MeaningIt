'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowRightLeft,
  Copy,
  Loader2,
  Mic,
  Volume2,
  Info,
  Lightbulb,
  Zap,
  Shield,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { languages } from '@/lib/languages';
import { handleTranslation } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useGamification } from '@/hooks/use-gamification';
import { useSpeak } from '@/hooks/use-speak';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { VoiceVisualizer } from './voice-visualizer';

/* -------------------------------------------------------------------------- */
/* Heavy tabs load on first open instead of with the page                     */
/* -------------------------------------------------------------------------- */

function TabLoading() {
  return (
    <div
      className="flex items-center justify-center p-10 text-sm text-muted-foreground"
      role="status"
    >
      <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
      Loading...
    </div>
  );
}

const ImageTranslator = dynamic(
  () => import('./image-translator').then((m) => m.ImageTranslator),
  { ssr: false, loading: () => <TabLoading /> },
);

const LiveTranslator = dynamic(
  () => import('./live-translator').then((m) => m.LiveTranslator),
  { ssr: false, loading: () => <TabLoading /> },
);

const ChatbotTutor = dynamic(
  () => import('./chatbot-tutor').then((m) => m.ChatbotTutor),
  { ssr: false, loading: () => <TabLoading /> },
);

const GamificationProfile = dynamic(
  () => import('./gamification-profile').then((m) => m.GamificationProfile),
  { ssr: false, loading: () => <TabLoading /> },
);

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const MAX_SOURCE_TEXT_LENGTH = 5_000;
// Every pause in typing costs one AI request, so wait a little longer.
const AUTO_TRANSLATE_DEBOUNCE_MS = 900;
const RATE_LIMIT_COOLDOWN_MS = 10_000;
const ERROR_TOAST_DEDUPE_MS = 5_000;
const MAX_SUGGESTIONS = 5;

function getLanguageName(code: string): string {
  return languages.find((language) => language.code === code)?.name ?? code;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function Translator() {
  const [sourceLang, setSourceLang] = React.useState('auto');
  const [targetLang, setTargetLang] = React.useState('es-ES');
  const [sourceText, setSourceText] = React.useState('');
  const [translatedText, setTranslatedText] = React.useState('');
  const [detectedLangName, setDetectedLangName] = React.useState<string | null>(null);
  const [isTranslating, setIsTranslating] = React.useState(false);
  const [toneAnalysis, setToneAnalysis] = React.useState<string | null>(null);
  const [toneSuggestions, setToneSuggestions] = React.useState<string[]>([]);
  const [isSpeedBoosted, setIsSpeedBoosted] = React.useState(false);
  const [isPrivateMode, setIsPrivateMode] = React.useState(false);
  // Bumped when a rate-limit cooldown ends, to re-run the auto-translation.
  const [retryTick, setRetryTick] = React.useState(0);

  const { toast } = useToast();
  const { logTextTranslation, logImageTranslation, logTutorMessage } = useGamification();
  const { speak, isSpeaking } = useSpeak();

  /* ------------------------------ Refs ----------------------------------- */

  const mountedRef = React.useRef(true);
  const requestIdRef = React.useRef(0);
  // Key of the request last sent. Identical requests are never sent twice.
  const lastKeyRef = React.useRef('');
  const cooldownUntilRef = React.useRef(0);
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastErrorToastRef = React.useRef({ description: '', at: 0 });
  const isFirstPrivateRunRef = React.useRef(true);

  // Latest values for async code, so callbacks never need them as dependencies.
  const sourceLangRef = React.useRef(sourceLang);
  const targetLangRef = React.useRef(targetLang);
  const speedBoostedRef = React.useRef(isSpeedBoosted);
  const privateModeRef = React.useRef(isPrivateMode);
  const toastRef = React.useRef(toast);
  const logTextTranslationRef = React.useRef(logTextTranslation);
  const logImageTranslationRef = React.useRef(logImageTranslation);
  const logTutorMessageRef = React.useRef(logTutorMessage);

  React.useEffect(() => {
    sourceLangRef.current = sourceLang;
    targetLangRef.current = targetLang;
    speedBoostedRef.current = isSpeedBoosted;
    privateModeRef.current = isPrivateMode;
    toastRef.current = toast;
    logTextTranslationRef.current = logTextTranslation;
    logImageTranslationRef.current = logImageTranslation;
    logTutorMessageRef.current = logTutorMessage;
  });

  /* ------------------------------ Helpers -------------------------------- */

  /** Shows an error toast, skipping repeats of the same message. */
  const notifyError = React.useCallback((title: string, description: string) => {
    const now = Date.now();
    const last = lastErrorToastRef.current;

    if (last.description === description && now - last.at < ERROR_TOAST_DEDUPE_MS) return;

    lastErrorToastRef.current = { description, at: now };
    toastRef.current({ variant: 'destructive', title, description });
  }, []);

  const clearTranslationResult = React.useCallback(() => {
    setTranslatedText('');
    setDetectedLangName(null);
    setToneAnalysis(null);
    setToneSuggestions([]);
  }, []);

  /* ------------------------------ Speech input --------------------------- */

  const handleSpeechResult = React.useCallback(
    (spokenText: string) => {
      if (spokenText.length > MAX_SOURCE_TEXT_LENGTH) {
        notifyError('Speech too long', 'Please speak a shorter sentence and try again.');
        return;
      }

      setSourceText(spokenText);
    },
    [notifyError],
  );

  const {
    isSupported: isSpeechSupported,
    isListening,
    start: startListening,
    stop: stopListening,
    abort: abortListening,
  } = useSpeechRecognition({ onResult: handleSpeechResult });

  /* ------------------------------ Translation ---------------------------- */

  const performTranslation = React.useCallback(
    async (rawText: string) => {
      const text = rawText.trim();

      if (!text) {
        requestIdRef.current += 1;
        lastKeyRef.current = '';
        clearTranslationResult();
        setIsTranslating(false);
        return;
      }

      if (text.length > MAX_SOURCE_TEXT_LENGTH) {
        notifyError(
          'Text too long',
          `Please keep your text under ${MAX_SOURCE_TEXT_LENGTH.toLocaleString()} characters.`,
        );
        return;
      }

      const currentSource = sourceLangRef.current;
      const currentTarget = targetLangRef.current;
      const boosted = speedBoostedRef.current;

      // Skip identical requests (same text, languages and mode).
      const key = `${currentSource}|${currentTarget}|${boosted ? 1 : 0}|${text}`;
      if (key === lastKeyRef.current) return;

      // During a rate-limit cooldown, wait: the retry tick re-runs this later.
      if (Date.now() < cooldownUntilRef.current) return;

      const requestId = ++requestIdRef.current;
      lastKeyRef.current = key;
      setIsTranslating(true);

      try {
        const result = await handleTranslation({
          text,
          sourceLanguage: currentSource === 'auto' ? 'auto' : getLanguageName(currentSource),
          targetLanguage: getLanguageName(currentTarget),
          isSpeedBoosted: boosted,
        });

        // Ignore stale responses from older requests.
        if (!mountedRef.current || requestId !== requestIdRef.current) return;

        if (result.success) {
          const translation = result.translation?.trim() ?? '';

          setTranslatedText(translation);
          setDetectedLangName(result.detectedLanguageName?.trim() || null);
          setToneAnalysis(result.toneAnalysis?.trim() || null);
          setToneSuggestions(
            Array.isArray(result.suggestions)
              ? result.suggestions
                  .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                  .slice(0, MAX_SUGGESTIONS)
              : [],
          );

          if (!privateModeRef.current && translation) {
            logTextTranslationRef.current(currentTarget);
          }

          return;
        }

        // Failed: allow the same text to be retried later.
        lastKeyRef.current = '';

        if (result.code === 'RATE_LIMITED' || result.code === 'SERVICE_BUSY') {
          cooldownUntilRef.current = Date.now() + RATE_LIMIT_COOLDOWN_MS;

          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            if (mountedRef.current) setRetryTick((tick) => tick + 1);
          }, RATE_LIMIT_COOLDOWN_MS + 50);
        }

        notifyError(
          'Translation Error',
          result.error || 'Could not translate the text. Please try again.',
        );
      } catch (error: unknown) {
        if (!mountedRef.current || requestId !== requestIdRef.current) return;

        lastKeyRef.current = '';
        console.error('[Translator] Translation failed.', error);

        notifyError(
          'Translation Error',
          'Something went wrong while translating. Please try again.',
        );
      } finally {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setIsTranslating(false);
        }
      }
    },
    [clearTranslationResult, notifyError],
  );

  // Debounced auto-translation.
  React.useEffect(() => {
    if (!sourceText.trim()) {
      requestIdRef.current += 1;
      lastKeyRef.current = '';
      clearTranslationResult();
      setIsTranslating(false);
      return;
    }

    const timer = setTimeout(() => {
      void performTranslation(sourceText);
    }, AUTO_TRANSLATE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    sourceText,
    sourceLang,
    targetLang,
    isSpeedBoosted,
    retryTick,
    performTranslation,
    clearTranslationResult,
  ]);

  // Reset when Private Mode changes (skipped on first render).
  React.useEffect(() => {
    if (isFirstPrivateRunRef.current) {
      isFirstPrivateRunRef.current = false;
      return;
    }

    if (isPrivateMode) {
      toastRef.current({
        title: 'Private Mode Enabled',
        description: 'Translation history and activity will not be saved.',
      });
    }

    requestIdRef.current += 1;
    lastKeyRef.current = '';
    setSourceText('');
    clearTranslationResult();
    setIsTranslating(false);
  }, [isPrivateMode, clearTranslationResult]);

  /* ------------------------------ Handlers ------------------------------- */

  const handleSwapLanguages = React.useCallback(() => {
    if (sourceLang === 'auto') {
      toastRef.current({
        title: "Can't swap from Auto-detect",
        description: 'Please select a specific source language before swapping.',
      });
      return;
    }

    abortListening();

    requestIdRef.current += 1;
    lastKeyRef.current = '';

    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    // The auto-translation effect translates the swapped text.
    setSourceText(translatedText.trim() ? translatedText : '');
    setDetectedLangName(null);
    setToneAnalysis(null);
    setToneSuggestions([]);
    setIsTranslating(false);
  }, [abortListening, sourceLang, targetLang, translatedText]);

  const handleCopyToClipboard = React.useCallback(async () => {
    const text = translatedText.trim();
    if (!text) return;

    try {
      if (!navigator.clipboard || !window.isSecureContext) {
        throw new Error('Clipboard API unavailable.');
      }

      await navigator.clipboard.writeText(text);

      toastRef.current({
        title: 'Copied to clipboard',
        description: 'The translated text has been copied.',
      });
    } catch (error: unknown) {
      console.error('[Translator] Clipboard copy failed.', error);

      toastRef.current({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Your browser blocked clipboard access. Please copy the text manually.',
      });
    }
  }, [translatedText]);

  const handleListen = React.useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }

    if (isTranslating) return;

    if (sourceLang === 'auto') {
      toastRef.current({
        variant: 'destructive',
        title: 'Select a language',
        description: 'Choose a specific source language before using voice input.',
      });
      return;
    }

    startListening(sourceLang);
  }, [isListening, isTranslating, sourceLang, startListening, stopListening]);

  const handleClearText = React.useCallback(() => {
    abortListening();

    requestIdRef.current += 1;
    lastKeyRef.current = '';

    setSourceText('');
    clearTranslationResult();
    setIsTranslating(false);
  }, [abortListening, clearTranslationResult]);

  const handleSpeakTranslation = React.useCallback(() => {
    if (!translatedText) return;

    // useSpeak handles its own errors and fallbacks.
    void speak({ text: translatedText, lang: targetLang });
  }, [speak, targetLang, translatedText]);

  const onImageTranslateSuccess = React.useCallback(() => {
    if (!privateModeRef.current) logImageTranslationRef.current();
  }, []);

  const onTutorMessageSent = React.useCallback(() => {
    if (!privateModeRef.current) logTutorMessageRef.current();
  }, []);

  /* ------------------------------ Lifecycle ------------------------------ */

  React.useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;

      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  const sourceLanguageName = getLanguageName(sourceLang);
  const targetLanguageName = getLanguageName(targetLang);

  /* -------------------------------- Render ------------------------------- */

  return (
    <Card className="w-full max-w-4xl border-0 bg-card/60 shadow-2xl backdrop-blur-xl">
      <CardHeader className="border-b p-4">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          {/* Source language */}
          <Select
            value={sourceLang}
            onValueChange={(value) => {
              if (!value) return;

              abortListening();
              setSourceLang(value);
              setDetectedLangName(null);
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px]" aria-label="Source language">
              <SelectValue placeholder="Source Language" />
            </SelectTrigger>

            <SelectContent>
              {languages.map((language) => (
                <SelectItem key={language.code} value={language.code}>
                  {language.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Swap */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSwapLanguages}
            className="shrink-0"
            disabled={sourceLang === 'auto' || isTranslating}
            aria-label="Swap source and target languages"
            title="Swap languages"
          >
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </Button>

          {/* Target language */}
          <Select
            value={targetLang}
            onValueChange={(value) => {
              if (value) setTargetLang(value);
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px]" aria-label="Target language">
              <SelectValue placeholder="Target Language" />
            </SelectTrigger>

            <SelectContent>
              {languages.map(
                (language) =>
                  language.code !== 'auto' && (
                    <SelectItem key={language.code} value={language.code}>
                      {language.name}
                    </SelectItem>
                  ),
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs defaultValue="text" className="w-full">
          <TabsList className="mx-auto mt-4 grid h-auto w-full max-w-lg grid-cols-5 rounded-xl bg-muted/60 p-1">
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="image">Image</TabsTrigger>
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="tutor">Tutor</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          {/* ==================== TEXT ==================== */}
          <TabsContent value="text" className="p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Source panel */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{sourceLanguageName}</p>
                    <p className="text-xs text-muted-foreground">
                      {sourceLang === 'auto' ? 'Automatic language detection' : 'Source text'}
                    </p>
                  </div>

                  {sourceText.length > 0 && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {sourceText.length.toLocaleString()}/
                      {MAX_SOURCE_TEXT_LENGTH.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Textarea
                    placeholder={
                      isPrivateMode
                        ? 'Private mode is on. Translation activity will not be saved.'
                        : 'Enter text to translate...'
                    }
                    value={sourceText}
                    onChange={(event) =>
                      setSourceText(event.target.value.slice(0, MAX_SOURCE_TEXT_LENGTH))
                    }
                    maxLength={MAX_SOURCE_TEXT_LENGTH}
                    className="h-48 resize-none bg-transparent text-base"
                    aria-label="Text to translate"
                    aria-describedby="translator-source-help"
                  />

                  {isTranslating && (
                    <div
                      className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-background/40 backdrop-blur-[1px]"
                      aria-hidden="true"
                    >
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>

                <div
                  id="translator-source-help"
                  className="flex min-h-10 items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      onClick={handleListen}
                      variant="outline"
                      size="icon"
                      disabled={!isSpeechSupported || isTranslating}
                      aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                      title={
                        !isSpeechSupported
                          ? 'Speech recognition is not supported'
                          : isListening
                            ? 'Stop listening'
                            : 'Voice input'
                      }
                    >
                      {isListening ? (
                        <VoiceVisualizer />
                      ) : (
                        <Mic className="h-5 w-5" aria-hidden="true" />
                      )}
                    </Button>

                    {isListening && (
                      <span className="text-sm text-muted-foreground" role="status">
                        Listening...
                      </span>
                    )}

                    {!isListening && sourceLang === 'auto' && detectedLangName && (
                      <div className="text-sm text-muted-foreground">
                        Detected:{' '}
                        <span className="font-medium text-foreground">{detectedLangName}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="private-mode"
                        checked={isPrivateMode}
                        onCheckedChange={setIsPrivateMode}
                        aria-label="Private mode"
                      />

                      <Label
                        htmlFor="private-mode"
                        className="flex cursor-pointer items-center gap-1.5"
                      >
                        <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
                        <span className="text-sm font-medium">Private</span>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="speed-boost"
                        checked={isSpeedBoosted}
                        onCheckedChange={setIsSpeedBoosted}
                        aria-label="Translation speed boost"
                      />

                      <Label
                        htmlFor="speed-boost"
                        className="flex cursor-pointer items-center gap-1.5"
                      >
                        <Zap className="h-4 w-4 text-amber-500" aria-hidden="true" />
                        <span className="text-sm font-medium">Boost</span>
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Tone analysis */}
                {!isSpeedBoosted && toneAnalysis && (
                  <Card className="border-dashed bg-muted/30 p-3">
                    <CardContent className="p-0">
                      <div className="flex items-start gap-3">
                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />

                        <div className="min-w-0">
                          <p className="text-sm font-semibold">Tone Analysis</p>
                          <p className="text-sm text-muted-foreground">{toneAnalysis}</p>
                        </div>
                      </div>

                      {toneSuggestions.length > 0 && (
                        <div className="mt-3 border-t border-dashed pt-3">
                          <div className="flex items-start gap-3">
                            <Lightbulb
                              className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
                              aria-hidden="true"
                            />

                            <div className="min-w-0">
                              <p className="text-sm font-semibold">Suggestions</p>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {toneSuggestions.map((suggestion, index) => (
                                  <Button
                                    type="button"
                                    key={`${suggestion}-${index}`}
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setSourceText(suggestion.slice(0, MAX_SOURCE_TEXT_LENGTH))
                                    }
                                    className="h-auto bg-background px-2 py-1 text-xs hover:bg-muted"
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

              {/* Translation panel */}
              <div className="relative flex flex-col gap-4">
                <div>
                  <p className="text-sm font-semibold">{targetLanguageName}</p>
                  <p className="text-xs text-muted-foreground">Translation</p>
                </div>

                <Textarea
                  placeholder="Translation"
                  value={translatedText}
                  readOnly
                  className="h-48 resize-none bg-muted/50 text-base"
                  aria-label="Translated text"
                />

                <div className="flex h-10 items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      void handleCopyToClipboard();
                    }}
                    variant="outline"
                    size="icon"
                    disabled={!translatedText}
                    aria-label="Copy translation"
                    title="Copy translation"
                  >
                    <Copy className="h-5 w-5" aria-hidden="true" />
                  </Button>

                  <Button
                    type="button"
                    onClick={handleSpeakTranslation}
                    variant="outline"
                    size="icon"
                    disabled={!translatedText || isSpeaking}
                    aria-label="Listen to translation"
                    title="Listen to translation"
                  >
                    {isSpeaking ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Volume2 className="h-5 w-5" aria-hidden="true" />
                    )}
                  </Button>

                  {translatedText && (
                    <Button
                      type="button"
                      onClick={handleClearText}
                      variant="ghost"
                      size="icon"
                      aria-label="Clear translation"
                      title="Clear"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ==================== IMAGE ==================== */}
          <TabsContent value="image" className="p-6">
            <ImageTranslator
              targetLang={targetLang}
              onTranslateSuccess={onImageTranslateSuccess}
            />
          </TabsContent>

          {/* ==================== LIVE ==================== */}
          <TabsContent value="live" className="p-6">
            <LiveTranslator lang1={sourceLang} lang2={targetLang} />
          </TabsContent>

          {/* ==================== TUTOR ==================== */}
          <TabsContent value="tutor" className="p-6">
            <ChatbotTutor
              targetLang={targetLang}
              onMessageSent={onTutorMessageSent}
              isPrivate={isPrivateMode}
            />
          </TabsContent>

          {/* ==================== PROFILE ==================== */}
          <TabsContent value="profile" className="p-6">
            <GamificationProfile />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}