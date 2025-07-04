export function VoiceVisualizer() {
  return (
    <div className="flex items-center justify-center gap-1 h-6 w-20">
      <span className="w-1 h-2 bg-accent rounded-full animate-wave" style={{ animationDelay: '0.1s' }} />
      <span className="w-1 h-4 bg-accent rounded-full animate-wave" style={{ animationDelay: '0.2s' }} />
      <span className="w-1 h-5 bg-accent rounded-full animate-wave" style={{ animationDelay: '0.3s' }} />
      <span className="w-1 h-3 bg-accent rounded-full animate-wave" style={{ animationDelay: '0.4s' }} />
      <span className="w-1 h-6 bg-accent rounded-full animate-wave" style={{ animationDelay: '0.5s' }} />
    </div>
  );
}
