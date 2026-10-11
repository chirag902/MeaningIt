type Level = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEY =
  /(text|translation|photo|image|datauri|apikey|api_key|token|secret|password|authorization|cookie|history|content|prompt|audio)/i;

const SEVERITY: Record<Level, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
};

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value === null || typeof value !== 'object') return value;

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : sanitize(val, depth + 1);
  }
  return out;
}

function write(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  if (level === 'debug' && process.env.NODE_ENV === 'production') return;

  const line = JSON.stringify({
    severity: SEVERITY[level],
    message,
    time: new Date().toISOString(),
    ...(sanitize(fields) as Record<string, unknown>),
  });

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => write('debug', message, fields),
  info: (message: string, fields?: Record<string, unknown>) => write('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write('error', message, fields),
};