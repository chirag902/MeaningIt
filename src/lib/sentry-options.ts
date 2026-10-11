import type { ErrorEvent } from '@sentry/nextjs';

/** Public by design: a DSN only lets clients send events. It can't read anything. */
export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  'https://c3c0af5dcaec80f17a9987f80a70e658@o4512236580569088.ingest.us.sentry.io/4512236580765696';

/** Health checks and static files would only waste your trace quota. */
export function tracesSampler(context: { name?: string }): number {
  const name = context.name ?? '';

  if (name.includes('/api/health') || name.includes('/_next/')) return 0;

  return 0.1;
}

/** Last line of defense: strips anything that could carry user content. */
export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
  }

  delete event.user;

  return event;
}