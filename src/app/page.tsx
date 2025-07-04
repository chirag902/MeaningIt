import { Translator } from '@/components/translator';

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-background">
      <div className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-primary font-headline">MeaningIt</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Instant, intelligent, and stylish translations.
        </p>
      </div>
      <Translator />
    </main>
  );
}
