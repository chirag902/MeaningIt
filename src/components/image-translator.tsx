
'use client';

import * as React from 'react';
import { Camera, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { handleImageTranslation } from '@/app/actions';
import { languages } from '@/lib/languages';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Textarea } from './ui/textarea';
import { runClientOCR } from '@/lib/client-ocr';

interface ImageTranslatorProps {
  targetLang: string;
  onTranslateSuccess: () => void;
}

async function translateTextWithGroq(text: string, targetLanguage: string) {
  if (!text) return '';
  try {
    const response = await fetch('/api/groq-translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage }),
    });
    if (!response.ok) {
      throw new Error('Translation API failed');
    }
    const result = await response.json();
    return result.translation || '';
  } catch (error) {
    console.error('Groq fallback translation error:', error);
    return 'Translation failed.';
  }
}

export const ImageTranslator = React.memo(function ImageTranslator({
  targetLang,
  onTranslateSuccess,
}: ImageTranslatorProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [processingMessage, setProcessingMessage] = React.useState('');
  const [translatedText, setTranslatedText] = React.useState('');

  const { toast } = useToast();

  const getCameraPermission = React.useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        variant: 'destructive',
        title: 'Camera Not Supported',
        description: 'Your browser does not support camera access.',
      });
      setHasCameraPermission(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCameraPermission(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions in your browser settings.',
      });
    }
  }, [toast]);

  React.useEffect(() => {
    getCameraPermission();
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [getCameraPermission]);

  const preprocessImage = (ctx: CanvasRenderingContext2D) => {
      const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const data = imageData.data;
      
      // Grayscale and Contrast
      const contrast = 128; // 0 to 255
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Grayscale (luminosity method is often better but average is simpler)
          const gray = (r + g + b) / 3;
          
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;

          // Apply contrast
          data[i] = factor * (data[i] - 128) + 128;
          data[i+1] = factor * (data[i+1] - 128) + 128;
          data[i+2] = factor * (data[i+2] - 128) + 128;
      }
      
      ctx.putImageData(imageData, 0, 0);
  }

  const handleCaptureAndTranslate = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsProcessing(true);
    setProcessingMessage('Capturing & Preprocessing...');
    setTranslatedText(''); // clear previous

    // Capture frame
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Upscale for better quality
    const scaleFactor = 2;
    canvas.width = video.videoWidth * scaleFactor;
    canvas.height = video.videoHeight * scaleFactor;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not get canvas context.' });
        setIsProcessing(false);
        return;
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Preprocess the image
    preprocessImage(ctx);

    // Get image data
    const photoDataUri = canvas.toDataURL('image/jpeg', 0.95);
    const targetLanguageName = languages.find((l) => l.code === targetLang)?.name ?? 'English';

    setProcessingMessage('Translating with AI...');

    // Call server action
    const result = await handleImageTranslation({
      photoDataUri,
      targetLanguage: targetLanguageName,
    });

    if (result.success) {
      if (result.translation === '__CLIENT_OCR_REQUIRED__') {
        // Server OCR failed, start client-side fallback
        setProcessingMessage('Server OCR failed. Trying on-device...');
        const extractedText = await runClientOCR(photoDataUri);

        if (!extractedText) {
          toast({
            variant: 'destructive',
            title: 'OCR Failed',
            description: 'Could not detect any text in the image. Try improving lighting or taking a clearer picture.',
          });
          setIsProcessing(false);
          return;
        }

        setProcessingMessage('Translating extracted text...');
        const finalTranslation = await translateTextWithGroq(extractedText, targetLanguageName);
        setTranslatedText(finalTranslation);
        onTranslateSuccess();

      } else {
         // Server OCR and translation was successful
        setTranslatedText(result.translation ?? '');
        onTranslateSuccess();
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Image Translation Error',
        description: result.error,
      });
    }

    setIsProcessing(false);
    setProcessingMessage('');
  };

  return (
    <div className="flex flex-col gap-4 items-center">

        <Alert className="bg-primary/5 border-primary/20">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle>For Best Results</AlertTitle>
          <AlertDescription className="text-xs">
            Use clear screenshots instead of camera photos. Ensure good contrast (light mode often works better than dark mode). Some text may not be detected depending on image quality.
          </AlertDescription>
        </Alert>

      <div className="relative w-full max-w-md aspect-video rounded-lg overflow-hidden border bg-muted">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />
        {hasCameraPermission === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 p-4 text-center">
            <Alert variant="destructive" className="w-auto">
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>
                Please allow camera access to use this feature.
              </AlertDescription>
            </Alert>
            <Button onClick={getCameraPermission} className="mt-4">
              Grant Permission
            </Button>
          </div>
        )}
        {isProcessing && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex flex-col items-center justify-center rounded-md text-center p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            {processingMessage && <p className="mt-4 font-semibold">{processingMessage}</p>}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <Button
        onClick={handleCaptureAndTranslate}
        disabled={isProcessing || hasCameraPermission !== true}
      >
        {isProcessing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Camera className="mr-2 h-4 w-4" />
        )}
        Scan &amp; Translate
      </Button>

      {translatedText && (
        <div className="w-full pt-4">
          <h3 className="font-semibold mb-2">Translated Text:</h3>
          <Textarea
            value={translatedText}
            readOnly
            className="h-32 bg-muted/50"
          />
        </div>
      )}
    </div>
  );
});
