'use client';

import * as React from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Translator } from '@/components/translator';
import { SplashScreen } from '@/components/splash-screen';

export default function Home() {
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 relative">
       <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="text-center mb-8">
        <h1 className="text-4xl sm:text-6xl font-black text-primary font-display tracking-tight">MeaningIt</h1>
        <p className="text-muted-foreground mt-4 text-lg max-w-xl mx-auto">
          Instant, intelligent, and stylish translations.
        </p>
      </div>
      <Translator />
    </main>
  );
}
