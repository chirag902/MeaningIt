'use client';

import { WifiOff } from 'lucide-react';

import { useOnlineStatus } from '@/hooks/use-network';

export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm text-destructive-foreground"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      You&apos;re offline. Translation needs an internet connection.
    </div>
  );
}