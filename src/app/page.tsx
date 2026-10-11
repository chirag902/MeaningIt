
"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Translator } from "@/components/translator";

const SPLASH_DURATION_MS = 1120;
const EXIT_DURATION_MS = 380;

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const splashTimer = window.setTimeout(() => {
      setIsExiting(true);
    }, reduceMotion ? 500 : SPLASH_DURATION_MS);

    const removeTimer = window.setTimeout(
      () => {
        setShowSplash(false);
      },
      reduceMotion
        ? 500 + 100
        : SPLASH_DURATION_MS + EXIT_DURATION_MS,
    );

    return () => {
      window.clearTimeout(splashTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center bg-background px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex w-full max-w-7xl items-center justify-end">
        <ThemeToggle />
      </header>

      <section
        aria-labelledby="meaningit-title"
        className="flex w-full max-w-7xl flex-1 flex-col items-center justify-center py-8 sm:py-12 lg:py-16"
      >
        <div className="mb-8 w-full text-center sm:mb-10">
          <h1
            id="meaningit-title"
            className="font-display text-4xl font-black tracking-tight text-primary sm:text-5xl lg:text-6xl"
          >
            MeaningIt
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:mt-4 sm:text-lg">
            Instant, intelligent, and natural translations across text, voice,
            conversations, and images.
          </p>
        </div>

        <div className="w-full">
          <Translator />
        </div>
      </section>

      {showSplash && (
        <div
          className={`meaningit-splash ${
            isExiting ? "meaningit-splash--exit" : ""
          }`}
          role="status"
          aria-label="MeaningIt is opening"
          aria-live="polite"
        >
          <div className="meaningit-splash__ambient" aria-hidden="true" />
          <div
            className="meaningit-splash__grid"
            aria-hidden="true"
          />

          <div className="meaningit-splash__content">
            <div className="meaningit-mark" aria-hidden="true">
              <div className="meaningit-mark__orbit meaningit-mark__orbit--one" />
              <div className="meaningit-mark__orbit meaningit-mark__orbit--two" />

              <div className="meaningit-mark__core">
                <svg
                  viewBox="0 0 64 64"
                  fill="none"
                  className="meaningit-mark__icon"
                >
                  <path
                    d="M13 17.5C13 13.9 15.9 11 19.5 11h25C48.1 11 51 13.9 51 17.5v19c0 3.6-2.9 6.5-6.5 6.5H31L20 52v-9h-.5c-3.6 0-6.5-2.9-6.5-6.5v-19Z"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M23 25h18M23 32h12"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                  <circle cx="44" cy="44" r="7" fill="#8B5CF6" />
                  <path
                    d="m41 44 2 2 4-4"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <span className="meaningit-mark__spark meaningit-mark__spark--one" />
              <span className="meaningit-mark__spark meaningit-mark__spark--two" />
              <span className="meaningit-mark__spark meaningit-mark__spark--three" />
            </div>

            <div className="meaningit-wordmark">
              <h2>
                Meaning<span>It</span>
              </h2>
              <p>LANGUAGE WITHOUT LIMITS</p>
            </div>

            <div className="meaningit-languages" aria-hidden="true">
              <span>Hola</span>
              <span>你好</span>
              <span>Bonjour</span>
              <span>नमस्ते</span>
              <span>こんにちは</span>
            </div>

            <div className="meaningit-loading" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>

          <p className="meaningit-footer">
            Every language. One connection.
          </p>
        </div>
      )}
    </main>
  );
}
