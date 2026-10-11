'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';

/**
 * Global theme provider for MeaningIt.
 *
 * Defaults live here so they're defined in one place. Props passed by the
 * caller (layout.tsx) override them.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
      // Namespaced so the saved preference can't collide with another app on
      // the same origin. Existing users reset to "system" once after this change.
      storageKey="meaningit-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}