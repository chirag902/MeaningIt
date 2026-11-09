'use client';

import * as React from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          minHeight: '100dvh',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <h1>Something went wrong</h1>
        <button onClick={reset} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  );
}