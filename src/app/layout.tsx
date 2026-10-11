import type { Metadata, Viewport } from 'next';
import { Urbanist } from 'next/font/google';

import './globals.css';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

// Urbanist is a variable font: omitting `weight` loads one file instead of six.
const fontSans = Urbanist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const APP_NAME = 'MeaningIt';
const APP_TITLE = 'MeaningIt — AI-Powered Multilingual Translator';
const APP_DESCRIPTION =
  'Translate text, voice, live conversations and images across many languages, and practice with an AI language tutor.';

/** Public URL of the deployed site. Set NEXT_PUBLIC_SITE_URL in production. */
function getSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  try {
    return new URL(raw || 'http://localhost:3000');
  } catch {
    // A malformed value must not break the build.
    return new URL('http://localhost:3000');
  }
}

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),

  title: {
    default: APP_TITLE,
    template: `%s | ${APP_NAME}`,
  },

  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  publisher: APP_NAME,
  category: 'technology',

  alternates: {
    canonical: '/',
  },

  robots: {
    index: true,
    follow: true,
  },

  // Keep only assets confirmed to exist in /public.
  icons: {
    icon: '/favicon.ico',
  },

  // The preview image comes from src/app/opengraph-image.tsx automatically.
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: APP_NAME,
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    url: '/',
  },

  twitter: {
    card: 'summary',
    title: APP_TITLE,
    description: APP_DESCRIPTION,
  },

  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-dvh bg-background font-sans antialiased',
          'selection:bg-primary/20 selection:text-foreground',
          fontSans.variable,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}