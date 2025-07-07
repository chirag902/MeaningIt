'use client';

import * as React from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { handleImageTranslation } from '@/app/actions';
import { languages } from '@/lib/languages';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Textarea } from './ui/textarea';

interface ImageTranslatorProps {
  targetLang: string;
}

export function ImageTranslator({ targetLang }: ImageTranslatorProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [translatedText, setTranslatedText] = React.useState('');
  const { toast } = useToast();

  React.useEffect(() => {
    const getCameraPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          variant: 'destructive',
          title: 'Camera Not Supported',
          description: 'Your browser does not support camera access.',
        });
        setHasCameraPermission(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
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
    };

    getCameraPermission();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);

  const handleCaptureAndTranslate = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessing(true);
    setTranslatedText('');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    const photoDataUri = canvas.toDataURL('image/jpeg');

    const result = await handleImageTranslation({
      photoDataUri,
      targetLanguage: languages.find(l => l.code === targetLang)?.name || 'Spanish',
    });

    if (result.success) {
      setTranslatedText(result.translation);
    } else {
      toast({
        variant: 'destructive',
        title: 'Image Translation Error',
        description: result.error,
      });
    }

    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="relative w-full max-w-md aspect-video rounded-lg overflow-hidden border bg-muted">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
        {hasCameraPermission === false && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
             <Alert variant="destructive" className="w-auto">
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>
                Please allow camera access to use this feature.
              </AlertDescription>
            </Alert>
          </div>
        )}
         {isProcessing && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-md">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <Button onClick={handleCaptureAndTranslate} disabled={isProcessing || !hasCameraPermission}>
        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
        Scan & Translate
      </Button>
      {translatedText && (
        <div className="w-full pt-4">
            <h3 className="font-semibold mb-2">Translated Text:</h3>
            <Textarea value={translatedText} readOnly className="h-32 bg-muted/50" />
        </div>
      )}
    </div>
  );
}
