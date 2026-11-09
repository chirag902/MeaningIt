'use client';

import * as React from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);

  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/** `false` is reliable. `true` only means a network interface exists. */
export function useOnlineStatus(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/** True once `active` has lasted longer than `delayMs`. */
export function useSlowHint(active: boolean, delayMs = 6_000): boolean {
  const [slow, setSlow] = React.useState(false);

  React.useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }

    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return slow;
}