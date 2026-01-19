/**
 * Sentry initialization for widget
 */

import * as Sentry from '@sentry/browser'

let isInitialized = false

export interface SentryConfig {
  dsn: string
  environment?: string
  release?: string
  agentId?: string
  apiUrl?: string
}

/**
 * Initialize Sentry for the widget
 * Should be called once at widget initialization
 */
export function initSentry(config: SentryConfig): void {
  if (isInitialized) {
    return
  }

  if (!config.dsn) {
    return // Sentry is optional
  }

  // Only initialize Sentry in production
  const isProduction = (config.environment || 'production') === 'production'
  if (!isProduction) {
    return // Sentry initialization disabled in development environment
  }

  Sentry.init({
    dsn: config.dsn,
    environment: 'production',
    release: config.release,
    tracesSampleRate: 0.1,
    
    // Replay can be used alongside session-based sampling.
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    integrations: [
      Sentry.replayIntegration({
        // Mask all text content and user input for privacy
        maskAllText: true,
        blockAllMedia: true,
      }),
      Sentry.browserTracingIntegration(),
    ],
    
    beforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint) {
      // Filter out known non-critical errors
      if (event.exception) {
        const error = hint.originalException
        // Ignore network errors that are expected
        if (error instanceof TypeError && error.message?.includes('Failed to fetch')) {
          return null
        }
        // Ignore CORS errors
        if (error instanceof TypeError && error.message?.includes('CORS')) {
          return null
        }
      }
      return event
    },
  })

  // Set widget-specific context
  if (config.agentId) {
    Sentry.setTag('agentId', config.agentId)
  }
  if (config.apiUrl) {
    Sentry.setTag('apiUrl', config.apiUrl)
  }
  Sentry.setTag('component', 'widget')

  isInitialized = true
}

/**
 * Set user context (when user is identified)
 */
export function setSentryUser(userId: string, email?: string, username?: string): void {
  Sentry.setUser({
    id: userId,
    email,
    username,
  })
}

/**
 * Set additional context
 */
export function setSentryContext(context: {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  conversationId?: string
}): void {
  if (context.tags) {
    Object.entries(context.tags).forEach(([key, value]) => {
      Sentry.setTag(key, value)
    })
  }

  if (context.extra) {
    Sentry.setExtras(context.extra)
  }

  if (context.conversationId) {
    Sentry.setTag('conversationId', context.conversationId)
  }
}

/**
 * Clear Sentry context
 */
export function clearSentryContext(): void {
  Sentry.setUser(null)
}

export { Sentry }

