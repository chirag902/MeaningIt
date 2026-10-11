'use client';

import * as React from 'react';

import { Camera, CheckCircle2, Info, Loader2, RefreshCw, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { languages } from '@/lib/languages';


import { handleImageTranslation } from '@/app/actions';

import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Textarea } from './ui/textarea';


interface ImageTranslatorProps {
  targetLang: string;
  onTranslateSuccess: () => void;
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

// Never upscale: extra pixels add no information, only OCR time.
const MAX_IMAGE_WIDTH = 1600;
const MAX_IMAGE_HEIGHT = 1600;
const JPEG_QUALITY = 0.85;
const MAX_TRANSLATION_TEXT_LENGTH = 8_000;
const TRANSLATION_TIMEOUT_MS = 20_000;

type ProcessingStage =
  | 'idle'
  | 'capturing'
  | 'preprocessing'
  | 'ocr'
  | 'translating'
  | 'complete';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getTargetLanguageName(targetLang: string): string {
  return (
    languages.find((language) => language.code === targetLang)?.name ??
    'English'
  );
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TRANSLATION_TEXT_LENGTH);
}

function hasMeaningfulText(text: string): boolean {
  const cleaned = text.trim();
  if (cleaned.length < 2) return false;

  const meaningfulCharacters = cleaned.match(/[\p{L}\p{N}]/gu);
  return Boolean(meaningfulCharacters && meaningfulCharacters.length >= 2);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Something went wrong while processing the image.';
}

function getCanvasDimensions(
  videoWidth: number,
  videoHeight: number,
): { width: number; height: number } {
  if (videoWidth <= 0 || videoHeight <= 0) {
    return { width: 0, height: 0 };
  }

  // Cap at 1 so we only ever downscale.
  const scale = Math.min(
    MAX_IMAGE_WIDTH / videoWidth,
    MAX_IMAGE_HEIGHT / videoHeight,
    1,
  );

  return {
    width: Math.max(1, Math.round(videoWidth * scale)),
    height: Math.max(1, Math.round(videoHeight * scale)),
  };
}

function drawPreprocessedImage(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = video.clientWidth;
  const ch = video.clientHeight;
  if (!vw || !vh || !cw || !ch) return false;

  // Reproduce object-cover: find the region of the frame the user actually sees.
  const coverScale = Math.max(cw / vw, ch / vh);
  let sw = cw / coverScale;
  let sh = ch / coverScale;
  let sx = (vw - sw) / 2;
  let sy = (vh - sh) / 2;

  // Optional scan guide: keep only the central band (matches a guide box overlay).
  const GUIDE_W = 0.92;
  const GUIDE_H = 0.6;
  sx += (sw * (1 - GUIDE_W)) / 2;
  sy += (sh * (1 - GUIDE_H)) / 2;
  sw *= GUIDE_W;
  sh *= GUIDE_H;

  const scale = Math.min(MAX_IMAGE_WIDTH / sw, MAX_IMAGE_HEIGHT / sh, 1);
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return false;

  context.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
  return true;
}

function canvasToDataUri(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
// Keep payloads comfortably under the server action body limit.
const TARGET_DATA_URI_LENGTH = 900_000;
const UPLOAD_JPEG_QUALITIES = [0.85, 0.7, 0.55];

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not open this image.'));
    image.src = url;
  });
}

/** Validates, downscales (never upscales) and re-encodes an uploaded image as JPEG. */
async function fileToOptimizedDataUri(file: File): Promise<string> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Unsupported image type. Please use a JPG, PNG, WebP, or GIF image.');
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('This image is too large. Please choose one under 15 MB.');
  }

  let bitmap: ImageBitmap | null = null;
  let image: HTMLImageElement | null = null;
  let objectUrl: string | null = null;
  const canvas = document.createElement('canvas');

  try {
    // createImageBitmap applies EXIF rotation and decodes off the main thread.
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        bitmap = null;
      }
    }

    if (!bitmap) {
      objectUrl = URL.createObjectURL(file);
      image = await loadImageElement(objectUrl);
    }

    const sourceWidth = bitmap ? bitmap.width : image!.naturalWidth;
    const sourceHeight = bitmap ? bitmap.height : image!.naturalHeight;

    if (!sourceWidth || !sourceHeight) {
      throw new Error('This image has invalid dimensions.');
    }

    const scale = Math.min(
      MAX_IMAGE_WIDTH / sourceWidth,
      MAX_IMAGE_HEIGHT / sourceHeight,
      1,
    );
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not prepare this image.');

    // JPEG has no transparency: without a white fill, transparent PNGs turn black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = 'high';
    context.drawImage((bitmap ?? image)!, 0, 0, width, height);

    let dataUri = '';
    for (const quality of UPLOAD_JPEG_QUALITIES) {
      dataUri = canvas.toDataURL('image/jpeg', quality);
      if (dataUri.length <= TARGET_DATA_URI_LENGTH) break;
    }

    if (!dataUri || dataUri === 'data:,') {
      throw new Error('Could not prepare this image.');
    }

    return dataUri;
  } finally {
    bitmap?.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function translateTextWithGroq(
  text: string,
  targetLanguage: string,
  signal: AbortSignal,
): Promise<string> {
  const cleanedText = cleanExtractedText(text);

  if (!hasMeaningfulText(cleanedText)) {
    throw new Error('No meaningful text was detected in the image.');
  }

  if (signal.aborted) {
    throw new DOMException('Translation was cancelled.', 'AbortError');
  }

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort(
      new DOMException('Translation timed out.', 'TimeoutError'),
    );
  }, TRANSLATION_TIMEOUT_MS);

  const abortFromCaller = () => controller.abort();
  signal.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch('/api/groq-translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanedText, targetLanguage }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = 'Translation service failed.';

      try {
        const errorBody: unknown = await response.json();
        if (
          typeof errorBody === 'object' &&
          errorBody !== null &&
          'error' in errorBody &&
          typeof errorBody.error === 'string'
        ) {
          message = errorBody.error;
        }
      } catch {
        // Server may return an empty or non-JSON error body.
      }

      throw new Error(message);
    }

    const result: unknown = await response.json();

    if (
      typeof result !== 'object' ||
      result === null ||
      !('translation' in result) ||
      typeof result.translation !== 'string'
    ) {
      throw new Error('Translation service returned an invalid response.');
    }

    const translation = result.translation.trim();

    if (!translation) {
      throw new Error('Translation service returned an empty translation.');
    }

    return translation;
  } catch (error: unknown) {
    if (signal.aborted) {
      throw new DOMException('Translation was cancelled.', 'AbortError');
    }

    if (controller.signal.aborted) {
      throw new Error('Translation timed out. Please try again.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal.removeEventListener('abort', abortFromCaller);
  }
}

function getProcessingMessage(stage: ProcessingStage): string {
  switch (stage) {
    case 'capturing':
      return 'Capturing image...';
    case 'preprocessing':
      return 'Preparing image...';
    case 'ocr':
      return 'Reading text from image...';
    case 'translating':
      return 'Translating with AI...';
    case 'complete':
      return 'Translation complete';
    default:
      return '';
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const ImageTranslator = React.memo(function ImageTranslator({
  targetLang,
  onTranslateSuccess,
}: ImageTranslatorProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const mountedRef = React.useRef(true);
  const processingRef = React.useRef(false);
  const requestIdRef = React.useRef(0);
  const translationAbortControllerRef = React.useRef<AbortController | null>(
    null,
  );

  const [hasCameraPermission, setHasCameraPermission] = React.useState<
    boolean | null
  >(null);
  const [isCameraReady, setIsCameraReady] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [processingStage, setProcessingStage] =
    React.useState<ProcessingStage>('idle');
  const [translatedText, setTranslatedText] = React.useState('');

  const { toast } = useToast();

  // Keep toast in a ref so a changing identity can never restart the camera.
  const toastRef = React.useRef(toast);
  React.useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const targetLanguageName = React.useMemo(
    () => getTargetLanguageName(targetLang),
    [targetLang],
  );

  // ---------------------------------------------------------------------------
  // Preload OCR engine so the first scan doesn't pay the cold-start cost
  // ---------------------------------------------------------------------------

  

  // ---------------------------------------------------------------------------
  // Camera cleanup
  // ---------------------------------------------------------------------------

  const stopCamera = React.useCallback(() => {
    const stream = streamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          console.warn('[ImageTranslator] Failed to stop camera track:', error);
        }
      });
    }

    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    if (mountedRef.current) {
      setIsCameraReady(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Camera permission
  // ---------------------------------------------------------------------------

  const getCameraPermission = React.useCallback(async () => {
    if (processingRef.current) return;

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setHasCameraPermission(false);
      toastRef.current({
        variant: 'destructive',
        title: 'Camera Not Supported',
        description: 'Your browser does not support camera access.',
      });
      return;
    }

    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      setHasCameraPermission(true);

      const video = videoRef.current;

      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        return;
      }

      video.srcObject = stream;

      try {
        await video.play();
      } catch (error) {
        console.warn('[ImageTranslator] Video play failed:', error);
      }

      if (mountedRef.current) {
        setIsCameraReady(video.readyState >= 2);
      }
    } catch (error: unknown) {
      console.error('[ImageTranslator] Camera access failed:', error);

      if (!mountedRef.current) return;

      setHasCameraPermission(false);
      setIsCameraReady(false);

      const message =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Please allow camera access in your browser settings.'
          : error instanceof DOMException && error.name === 'NotFoundError'
            ? 'No camera was found on this device.'
            : 'Unable to access your camera. Please try again.';

      toastRef.current({
        variant: 'destructive',
        title: 'Camera Access Failed',
        description: message,
      });
    }
  }, [stopCamera]);

  // ---------------------------------------------------------------------------
  // Camera lifecycle
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    mountedRef.current = true;
    void getCameraPermission();

    return () => {
      mountedRef.current = false;

      translationAbortControllerRef.current?.abort();
      translationAbortControllerRef.current = null;

      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Ignore cleanup failures.
          }
        });
      }
      streamRef.current = null;

      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
    };
  }, [getCameraPermission]);

  // Cancel any in-flight work when the target language changes.
  React.useEffect(() => {
    requestIdRef.current += 1;
    translationAbortControllerRef.current?.abort();
    translationAbortControllerRef.current = null;
    processingRef.current = false;
    setIsProcessing(false);
    setProcessingStage('idle');
  }, [targetLang]);

  // ---------------------------------------------------------------------------
  // Video readiness
  // ---------------------------------------------------------------------------

  const handleVideoReady = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsCameraReady(
      video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2,
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Capture + OCR + translation
  // ---------------------------------------------------------------------------

  
      // Shared lifecycle for camera and upload: request tracking, cancellation,
  // stale-result protection, errors and cleanup live in one place.
  const runTranslation = React.useCallback(
    async (buildPhoto: () => Promise<string>) => {
      if (processingRef.current) return;

      const currentRequestId = requestIdRef.current + 1;
      requestIdRef.current = currentRequestId;
      processingRef.current = true;

      setIsProcessing(true);
      setProcessingStage('capturing');
      setTranslatedText('');

      translationAbortControllerRef.current?.abort();
      const abortController = new AbortController();
      translationAbortControllerRef.current = abortController;

      const isStale = () =>
        !mountedRef.current ||
        requestIdRef.current !== currentRequestId ||
        abortController.signal.aborted;

      try {
        const photoDataUri = await buildPhoto();

        if (isStale()) return;

        setProcessingStage('translating');

        const result = await handleImageTranslation({
          photoDataUri,
          targetLanguage: targetLanguageName,
        });

        // A server action can't be cancelled mid-flight, so discard stale results.
        if (isStale()) return;

        if (!result.success) {
          if (result.code === 'IMAGE_UNREADABLE') {
            toastRef.current({
              variant: 'destructive',
              title: 'No Text Detected',
              description:
                'Make sure the text is clear and fills the image. Dark text on a plain background works best.',
            });
            return;
          }

          throw new Error(result.error);
        }

        const finalTranslation = result.translation.trim();

        if (!finalTranslation) {
          throw new Error('The translation came back empty. Please try again.');
        }

        setTranslatedText(finalTranslation);
        setProcessingStage('complete');
        onTranslateSuccess();
      } catch (error: unknown) {
        if (
          (error instanceof DOMException && error.name === 'AbortError') ||
          abortController.signal.aborted
        ) {
          return;
        }

        if (!mountedRef.current || requestIdRef.current !== currentRequestId) {
          return;
        }

        console.error('[ImageTranslator] Image translation failed:', error);

        toastRef.current({
          variant: 'destructive',
          title: 'Image Translation Failed',
          description: getErrorMessage(error),
        });
      } finally {
        if (requestIdRef.current === currentRequestId) {
          processingRef.current = false;

          if (mountedRef.current) {
            setIsProcessing(false);
            setProcessingStage('idle');

            if (translationAbortControllerRef.current === abortController) {
              translationAbortControllerRef.current = null;
            }
          }
        }
      }
    },
    [onTranslateSuccess, targetLanguageName],
  );

  const handleCaptureAndTranslate = React.useCallback(() => {
    if (processingRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (
      !video ||
      !canvas ||
      !isCameraReady ||
      video.readyState < 2 ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      toastRef.current({
        variant: 'destructive',
        title: 'Camera Not Ready',
        description: 'Please wait for the camera to initialize and try again.',
      });
      return;
    }

    void runTranslation(async () => {
      // Let the browser paint the latest camera frame first.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      setProcessingStage('preprocessing');

      if (!drawPreprocessedImage(video, canvas)) {
        throw new Error('Could not capture a valid camera frame.');
      }

      const photoDataUri = canvasToDataUri(canvas);

      if (!photoDataUri || photoDataUri === 'data:,') {
        throw new Error('Could not prepare the captured image.');
      }

      return photoDataUri;
    });
  }, [isCameraReady, runTranslation]);

  const handleFileSelected = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      // Reset so choosing the same file again still fires onChange.
      event.target.value = '';

      if (!file) return;

      void runTranslation(async () => {
        setProcessingStage('preprocessing');
        return fileToOptimizedDataUri(file);
      });
    },
    [runTranslation],
  );
  // ---------------------------------------------------------------------------
  // Clear translation
  // ---------------------------------------------------------------------------

  const handleClearTranslation = React.useCallback(() => {
    requestIdRef.current += 1;
    translationAbortControllerRef.current?.abort();
    translationAbortControllerRef.current = null;
    setTranslatedText('');
    setProcessingStage('idle');
  }, []);

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  const processingMessage = getProcessingMessage(processingStage);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <Alert className="w-full border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertTitle>Get Better Image Translations</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed">
        Place the text inside the dashed box and hold the camera steady. Dark text on a plain, light background works best. Hold steady in good light and avoid glare.
        </AlertDescription>
      </Alert>

      <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-xl border bg-muted shadow-sm">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay
          playsInline
          muted
          aria-label="Camera preview for image translation"
          onLoadedMetadata={handleVideoReady}
          onCanPlay={handleVideoReady}
        />
         <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[60%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-dashed border-primary/70"
        />

        {!isCameraReady && hasCameraPermission === true && !isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm font-medium">Starting camera...</p>
            </div>
          </div>
        )}

        {hasCameraPermission === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-4 text-center backdrop-blur-sm">
            <Alert variant="destructive" className="w-full max-w-sm">
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>
                Allow camera access to scan and translate text.
              </AlertDescription>
            </Alert>

            <Button
              type="button"
              onClick={() => void getCameraPermission()}
              className="mt-4"
              variant="secondary"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        )}

        {isProcessing && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-background/70 p-4 text-center backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-9 w-9 animate-spin text-primary" />

            {processingMessage && (
              <p className="mt-4 text-sm font-semibold">{processingMessage}</p>
            )}

            {processingStage === 'ocr' && (
              <p className="mt-1 text-xs text-muted-foreground">
                First scan may take a little longer.
              </p>
            )}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          onClick={handleCaptureAndTranslate}
          disabled={
            isProcessing || hasCameraPermission !== true || !isCameraReady
          }
          className="w-full sm:flex-1"
          size="lg"
        >
          {isProcessing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Camera className="mr-2 h-4 w-4" />
          )}
          {isProcessing ? 'Processing...' : 'Scan & Translate'}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="w-full sm:flex-1"
          size="lg"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload Image
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileSelected}
          aria-label="Upload an image to translate"
        />

        {translatedText && !isProcessing && (
          <Button
            type="button"
            variant="outline"
            onClick={handleClearTranslation}
            className="w-full sm:w-auto"
          >
            Clear
          </Button>
        )}
      </div>

      {translatedText && (
        <div className="w-full pt-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className="h-4 w-4 text-primary"
                aria-hidden="true"
              />
              <h3 className="font-semibold">Translated Text</h3>
            </div>

            <span className="text-xs text-muted-foreground">
              {targetLanguageName}
            </span>
          </div>

          <Textarea
            value={translatedText}
            onChange={(event) => setTranslatedText(event.target.value)}
            className="min-h-32 resize-y bg-muted/50 leading-relaxed"
            aria-label={`Translated text in ${targetLanguageName}`}
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
});