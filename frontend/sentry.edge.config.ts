/**
 * Sentry Edge Configuration
 * This file configures Sentry for Edge runtime (middleware, edge functions)
 */

import * as Sentry from '@sentry/nextjs'

// Only initialize Sentry in production
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production',
    release: process.env.APP_VERSION,
    tracesSampleRate: 0.1,
  })
}

