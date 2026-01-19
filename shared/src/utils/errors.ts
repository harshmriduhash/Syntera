/**
 * Shared Error Utilities
 * Standardized error handling across all services
 */

import { Response } from 'express'
import { createLogger } from '../logger/index.js'

const logger = createLogger('shared:errors')

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public isOperational = true
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export interface ErrorResponse {
  error: string
  code?: string
  details?: unknown
}

// Express error handler (for backend services)
export function handleError(err: unknown, res: Response): Response {
  if (err instanceof AppError) {
    logger.warn('Operational error', { 
      statusCode: err.statusCode, 
      message: err.message,
      code: err.code,
    })
    return res.status(err.statusCode).json({ 
      error: err.message,
      code: err.code,
    })
  }

  if (err instanceof Error) {
    logger.error('Unexpected error', { 
      error: err.message, 
      stack: err.stack 
    })
    return res.status(500).json({ 
      error: 'Internal server error' 
    })
  }

  logger.error('Unknown error', { error: err })
  return res.status(500).json({ 
    error: 'Internal server error' 
  })
}

export function notFound(res: Response, resource: string, id: string): Response {
  return res.status(404).json({ 
    error: `${resource} with id ${id} not found` 
  })
}

export function forbidden(res: Response, message = 'Access forbidden'): Response {
  return res.status(403).json({ error: message })
}

export function badRequest(res: Response, message: string): Response {
  return res.status(400).json({ error: message })
}

// Frontend error handler (for client-side)
export function handleApiError(error: unknown, defaultMessage = 'An error occurred'): ErrorResponse {
  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: string }
    return {
      error: error.message || defaultMessage,
      code: errorWithCode.code,
      details: error,
    }
  }

  if (typeof error === 'string') {
    return { error }
  }

  return { 
    error: defaultMessage, 
    details: error 
  }
}














