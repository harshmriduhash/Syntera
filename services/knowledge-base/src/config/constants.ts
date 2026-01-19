/**
 * Processing Constants
 * Configuration values for document processing
 */

export const PROCESSING_CONSTANTS = {
  TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_TEXT_LENGTH: 3 * 1024 * 1024, // 3MB
  BATCH_SIZE_SMALL: 50, // For documents with <= 100 chunks
  BATCH_SIZE_LARGE: 25, // For documents with > 100 chunks
  BATCH_DELAY_MS: 0, // No delay between batches (removed for faster processing)
  GC_INTERVAL: 10, // Trigger GC every N batches (less frequent)
  EMBEDDING_TIMEOUT_MS: 30000, // 30 seconds per embedding batch
} as const

