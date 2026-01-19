/**
 * Sentry Server Configuration
 * This file configures Sentry for the server-side (API routes, server components)
 */

import * as Sentry from '@sentry/nextjs'

// Only initialize Sentry in production
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production',
    release: process.env.APP_VERSION,
    tracesSampleRate: 0.1,
    integrations: [
    Sentry.httpIntegration(),
  ],
  
  beforeSend(event, hint) {
    // Filter out known non-critical errors
    if (event.exception) {
      const error = hint.originalException
      // Ignore validation errors (these are expected)
      if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
        return null
      }
    }
    return event
  },
  })
}

