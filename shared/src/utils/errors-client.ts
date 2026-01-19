/**
 * Client-Safe Error Utilities
 * Error handling functions that don't require server-only dependencies
 */

export interface ErrorResponse {
  error: string
  code?: string
  details?: unknown
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













