import { IntroSplash } from '@/components/intro-splash';
import { ThemeToggle } from '@/components/theme-toggle';
import { Translator } from '@/components/translator';

export default function Home() {
  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center bg-background px-4 py-6 sm:px-6 lg:px-8">
      {/* Lets keyboard and screen reader users jump past the header. */}
      <a
        href="#translator"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to translator
      </a>

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

        <div id="translator" tabIndex={-1} className="w-full outline-none">
          <Translator />
        </div>
      </section>

      <IntroSplash />
    </main>
  );
}