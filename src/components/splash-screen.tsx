export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="animate-pulse">
        <h1 className="text-6xl sm:text-8xl font-black text-primary font-display tracking-tight">
          MeaningIt
        </h1>
      </div>
    </div>
  );
}
