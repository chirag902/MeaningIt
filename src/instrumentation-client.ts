// Configures Sentry in the browser. Runs whenever a user loads a page.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

import { SENTRY_DSN, scrubEvent, tracesSampler } from '@/lib/sentry-options';

Sentry.init({
  dsn: SENTRY_DSN,

  // Production only: dev errors would pollute your issue list and quota.
  enabled: process.env.NODE_ENV === 'production',

  environment: process.env.NODE_ENV,

  // 10% of page loads are traced. A browser trace on every visit would use
  // your quota and add overhead on your users' phones.
  tracesSampler,

  // Never send user data or request bodies.
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },

  // Errors you can't act on. Removing them keeps alerts meaningful.
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'AbortError',
    'The operation was aborted',
    'Load failed',
    'Failed to fetch',
    'NetworkError when attempting to fetch resource',
    'NotAllowedError', // user denied camera/mic/audio permission
  ],

  // Browser extensions throw errors that aren't yours.
  denyUrls: [/^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^safari-extension:\/\//i],

  beforeSend: scrubEvent,
});

// Keep this export: it traces page navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;