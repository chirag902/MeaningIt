// Configures Sentry for the Node.js server (API routes, server actions).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

import { SENTRY_DSN, scrubEvent, tracesSampler } from '@/lib/sentry-options';

Sentry.init({
  dsn: SENTRY_DSN,

  // Production only: dev errors would pollute your issue list and quota.
  // Set SENTRY_FORCE_ENABLE=1 to test locally.
  enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_FORCE_ENABLE === '1',

  environment: process.env.NODE_ENV,

  // 10% of requests are traced, and health checks never.
  tracesSampler,

  // Never send user data or request/response bodies. Server actions carry
  // users' text, chat messages and base64 images.
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },

  beforeSend: scrubEvent,
});