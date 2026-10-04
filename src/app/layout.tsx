import type { Metadata, Viewport } from "next";
import "./globals.css";

import { Urbanist } from "next/font/google";

import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: {
    default: "MeaningIt",
    template: "%s | MeaningIt",
  },
  description:
    "MeaningIt is an intelligent multilingual translator for text, voice, live conversations, and images.",
  applicationName: "MeaningIt",
  generator: "Next.js",
  keywords: [
    "translator",
    "AI translator",
    "multilingual translator",
    "voice translator",
    "image translator",
    "MeaningIt",
  ],
  authors: [{ name: "MeaningIt" }],
  creator: "MeaningIt",
  publisher: "MeaningIt",
  icons: {
    icon: "/favicon.ico",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
};

const fontSans = Urbanist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
  weight: ["400", "700", "900"],
});

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
          fontSans.variable
        )}
      >
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}