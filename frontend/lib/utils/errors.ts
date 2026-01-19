/**
 * Error Handling Utilities
 * Uses shared error utilities with frontend-specific additions
 */

import { toast } from 'sonner'
import { logger } from './logger'
import { handleApiError as sharedHandleApiError, type ErrorResponse } from '@syntera/shared/client'

// Frontend-specific error interface (compatible with shared)
export interface AppError {
  message: string
  code?: string
  details?: unknown
}

/**
 * Handle API errors consistently (frontend wrapper)
 * Converts shared ErrorResponse to frontend AppError format
 */
export function handleApiError(error: unknown, defaultMessage = 'An error occurred'): AppError {
  const errorResponse = sharedHandleApiError(error, defaultMessage)
  return {
    message: errorResponse.error, // Convert 'error' to 'message' for frontend
    code: errorResponse.code,
    details: errorResponse.details,
  }
}

/**
 * Show error toast with consistent styling
 */
export function showErrorToast(error: unknown, defaultMessage = 'An error occurred'): void {
  const appError = handleApiError(error, defaultMessage)
  toast.error(appError.message)
}

/**
 * Show success toast
 */
export function showSuccessToast(message: string): void {
  toast.success(message)
}

/**
 * Log error for debugging
 */
export function logError(error: unknown, context?: string): void {
  logger.error(context || 'Error', { error })
  // In production, you might want to send to error tracking service
}
