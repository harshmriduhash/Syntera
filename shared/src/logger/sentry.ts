/**
 * Sentry initialization for backend services
 * Call this before creating loggers to enable Sentry error tracking
 */

import * as Sentry from '@sentry/node'
import type winston from 'winston'

interface WinstonLogEntry {
  level: string
  message: string
  error?: Error
  service?: string
  agentId?: string
  userId?: string
  conversationId?: string
  timestamp?: string
  [key: string]: unknown
}

export interface SentryConfig {
  dsn: string
  environment?: string
  release?: string
  tracesSampleRate?: number
}

let isInitialized = false

/**
 * Initialize Sentry for backend services
 * Should be called once at application startup
 */
export function initSentry(config: SentryConfig): void {
  if (isInitialized) {
    return
  }

  // Only initialize Sentry in production
  const isProduction = (config.environment || process.env.NODE_ENV) === 'production'
  if (!isProduction) {
    return // Sentry initialization disabled in development environment
  }

  Sentry.init({
    dsn: config.dsn,
    environment: 'production',
    release: config.release || process.env.APP_VERSION,
    tracesSampleRate: config.tracesSampleRate ?? 0.1,
    integrations: [
      // Automatically instrument Node.js libraries and frameworks
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  })

  isInitialized = true
}

/**
 * Get Sentry transport for Winston
 * Returns null if Sentry is not initialized
 */
export function getSentryTransport(): winston.transport | null {
  if (!isInitialized) {
    return null
  }

  // Create custom Winston transport for Sentry
  const WinstonTransport = require('winston-transport')
  
  class SentryWinstonTransport extends WinstonTransport {
    log(info: WinstonLogEntry, callback: () => void): void {
      setImmediate(() => {
        if (info.level === 'error' && info.message) {
          // Capture error with context
          const error = info.error || new Error(info.message)
          
          Sentry.withScope((scope) => {
            // Add metadata as context
            if (info.service) {
              scope.setTag('service', info.service)
            }
            if (info.agentId) {
              scope.setTag('agentId', info.agentId)
            }
            if (info.userId) {
              scope.setTag('userId', info.userId)
            }
            if (info.conversationId) {
              scope.setTag('conversationId', info.conversationId)
            }
            
            // Add extra data
            const extra: Record<string, unknown> = {}
            Object.keys(info).forEach((key) => {
              if (!['level', 'message', 'error', 'service', 'agentId', 'userId', 'conversationId', 'timestamp'].includes(key)) {
                extra[key] = info[key]
              }
            })
            if (Object.keys(extra).length > 0) {
              scope.setExtras(extra)
            }
            
            Sentry.captureException(error)
          })
        }
      })
      
      callback()
    }
  }
  
  return new SentryWinstonTransport() as winston.transport
}

/**
 * Set user context for Sentry
 */
export function setSentryUser(userId: string, email?: string, username?: string): void {
  Sentry.setUser({
    id: userId,
    email,
    username,
  })
}

/**
 * Set additional context (tags, extra data)
 */
export function setSentryContext(context: {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}): void {
  if (context.tags) {
    Object.entries(context.tags).forEach(([key, value]) => {
      Sentry.setTag(key, value)
    })
  }

  if (context.extra) {
    Sentry.setExtras(context.extra)
  }
}

/**
 * Clear Sentry context
 */
export function clearSentryContext(): void {
  Sentry.setUser(null)
}

export { Sentry }

