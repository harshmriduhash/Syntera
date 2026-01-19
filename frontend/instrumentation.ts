/**
 * Next.js Instrumentation Hook
 * This file is executed once when the server starts
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only initialize Sentry on server-side
    if (process.env.SENTRY_DSN) {
      await import('./sentry.server.config')
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Initialize Sentry for edge runtime
    if (process.env.SENTRY_DSN) {
      await import('./sentry.edge.config')
    }
  }
}

