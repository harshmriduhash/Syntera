/**
 * Logger utility for the frontend
 * Provides structured logging with configurable levels
 * Similar to widget logger but adapted for Next.js frontend
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerConfig {
  level: LogLevel
  prefix: string
  enabled: boolean
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class Logger {
  private config: LoggerConfig

  constructor(config: Partial<LoggerConfig> = {}) {
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    this.config = {
      level: config.level || (isDevelopment ? 'debug' : 'warn'),
      prefix: config.prefix || '[Syntera Frontend]',
      enabled: config.enabled !== false,
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level]
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return

    const prefix = `${this.config.prefix}`
    const timestamp = new Date().toISOString()
    const logMessage = `${prefix} [${timestamp}] ${message}`

    switch (level) {
      case 'debug':
        console.debug(logMessage, ...args)
        break
      case 'info':
        console.info(logMessage, ...args)
        break
      case 'warn':
        console.warn(logMessage, ...args)
        break
      case 'error':
        console.error(logMessage, ...args)
        break
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.formatMessage('debug', message, ...args)
  }

  info(message: string, ...args: unknown[]): void {
    this.formatMessage('info', message, ...args)
  }

  warn(message: string, ...args: unknown[]): void {
    this.formatMessage('warn', message, ...args)
  }

  error(message: string, ...args: unknown[]): void {
    this.formatMessage('error', message, ...args)
  }

  setLevel(level: LogLevel): void {
    this.config.level = level
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
  }
}

// Export singleton instance
export const logger = new Logger()

// Export class for custom instances if needed
export { Logger, type LogLevel, type LoggerConfig }



