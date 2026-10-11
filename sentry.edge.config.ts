// Configures Sentry for edge features (middleware, edge routes).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

import { SENTRY_DSN, scrubEvent, tracesSampler } from '@/lib/sentry-options';

Sentry.init({
  dsn: SENTRY_DSN,

  enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_FORCE_ENABLE === '1',

  environment: process.env.NODE_ENV,

  tracesSampler,

  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },

  beforeSend: scrubEvent,
});