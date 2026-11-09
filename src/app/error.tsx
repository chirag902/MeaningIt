'use client';

import * as React from 'react';
import * as Sentry from '@sentry/nextjs';

import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        The page hit an unexpected error. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}