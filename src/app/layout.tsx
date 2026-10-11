
import type { Metadata, Viewport } from "next";
import { Urbanist } from "next/font/google";

import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

const fontSans = Urbanist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const APP_NAME = "MeaningIt";
const APP_DESCRIPTION =
  "Translate text, voice, live conversations, and images with MeaningIt's intelligent multilingual translation platform.";

export const metadata: Metadata = {
  title: {
    default: "MeaningIt — AI-Powered Multilingual Translator",
    template: "%s | MeaningIt",
  },

  description:
    "MeaningIt helps you translate text, voice, live conversations, and images while supporting AI-powered language learning.",

  applicationName: APP_NAME,

  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  publisher: APP_NAME,

  category: "technology",

  keywords: [
    "MeaningIt",
    "AI translator",
    "multilingual translator",
    "language translator",
    "text translation",
    "voice translation",
    "live conversation translator",
    "image translator",
    "OCR translation",
    "AI language learning",
    "English translator",
    "Hindi translator",
  ],

  referrer: "origin-when-cross-origin",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  // Keep only assets confirmed to exist in /public.
  icons: {
    icon: "/favicon.ico",
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: APP_NAME,
    title: "MeaningIt — AI-Powered Multilingual Translator",
    description: APP_DESCRIPTION,
    // Add an Open Graph image after creating /public/og-image.png.
  },

  twitter: {
    card: "summary",
    title: "MeaningIt — AI-Powered Multilingual Translator",
    description: APP_DESCRIPTION,
    // Change to "summary_large_image" after adding a valid preview image.
  },

  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#ffffff",
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#09090b",
    },
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
          "min-h-screen bg-background font-sans antialiased",
          "selection:bg-primary/20 selection:text-foreground",
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
