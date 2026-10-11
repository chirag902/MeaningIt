"use client";

import * as React from "react";

export const SplashScreen = React.memo(function SplashScreen() {
  return (
    <div
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-background"
      role="status"
      aria-label="Loading MeaningIt"
    >
      <div className="flex flex-col items-center">
        <h1
          className="font-display text-5xl font-black tracking-tight text-primary sm:text-7xl lg:text-8xl"
          aria-hidden="true"
        >
          MeaningIt
        </h1>

        <div
          className="mt-6 flex items-center gap-1.5"
          aria-hidden="true"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
        </div>

        <span className="sr-only">Loading MeaningIt</span>
      </div>
    </div>
  );
});

SplashScreen.displayName = "SplashScreen";