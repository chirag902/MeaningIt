"use client"

import * as React from "react"
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes"

/**
 * Global theme provider for MeaningIt.
 *
 * Features:
 * - Light / dark / system themes
 * - Persists user's preference
 * - Prevents unnecessary transition animations when switching
 * - Supports Next.js App Router
 * - Avoids importing internal next-themes files
 * - Fully typed
 */
export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}