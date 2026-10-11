'use client';

import * as React from 'react';

const SESSION_KEY = 'meaningit:splash-seen';

// Shortened: every splash costs your users time on slow phones.
const SPLASH_MS = 900;
const EXIT_MS = 350;
const REDUCED_MOTION_SPLASH_MS = 400;
const REDUCED_MOTION_EXIT_MS = 100;

const GREETINGS = ['Hola', '你好', 'Bonjour', 'नमस्ते', 'こんにちは'] as const;

function hasSeenSplash(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    // Storage can be blocked (private browsing, strict settings).
    return false;
  }
}

function markSplashSeen(): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Ignore: the splash will simply show again next time.
  }
}

export function IntroSplash() {
  const [visible, setVisible] = React.useState(true);
  const [exiting, setExiting] = React.useState(false);

  React.useEffect(() => {
    // Returning visitors in this session skip the splash immediately.
    if (hasSeenSplash()) {
      setVisible(false);
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const exitAt = reduceMotion ? REDUCED_MOTION_SPLASH_MS : SPLASH_MS;
    const removeAt = exitAt + (reduceMotion ? REDUCED_MOTION_EXIT_MS : EXIT_MS);

    const exitTimer = window.setTimeout(() => setExiting(true), exitAt);

    const removeTimer = window.setTimeout(() => {
      // Marked on completion (not on start) so React Strict Mode's
      // double-run in development can't hide the splash early.
      markSplashSeen();
      setVisible(false);
    }, removeAt);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`meaningit-splash ${exiting ? 'meaningit-splash--exit' : ''}`}
      // Stops blocking taps as soon as the fade-out begins.
      style={exiting ? { pointerEvents: 'none' } : undefined}
      role="status"
      aria-label="MeaningIt is opening"
      aria-live="polite"
    >
      <div className="meaningit-splash__ambient" aria-hidden="true" />
      <div className="meaningit-splash__grid" aria-hidden="true" />

      <div className="meaningit-splash__content">
        <div className="meaningit-mark" aria-hidden="true">
          <div className="meaningit-mark__orbit meaningit-mark__orbit--one" />
          <div className="meaningit-mark__orbit meaningit-mark__orbit--two" />

          <div className="meaningit-mark__core">
            <svg viewBox="0 0 64 64" fill="none" className="meaningit-mark__icon">
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
          {GREETINGS.map((greeting) => (
            <span key={greeting}>{greeting}</span>
          ))}
        </div>

        <div className="meaningit-loading" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <p className="meaningit-footer">Every language. One connection.</p>
    </div>
  );
}