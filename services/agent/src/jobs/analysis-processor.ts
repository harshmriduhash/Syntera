/**
 * Scheduled Job: Auto-Threading and Sentiment Analysis Processor
 * Processes ended conversations in batches using LLM
 */

import { createLogger } from '@syntera/shared/logger/index.js'
import { Conversation } from '@syntera/shared/models/index.js'
import { batchProcessConversations } from '../services/threading-analyzer.js'

const logger = createLogger('agent-service:analysis-processor')

const BATCH_SIZE = 50 // Process 50 conversations at a time
const PROCESS_INTERVAL_MS = 5 * 60 * 1000 // Run every 5 minutes

let processingInterval: NodeJS.Timeout | null = null

/**
 * Process ended conversations that haven't been analyzed
 */
async function processEndedConversations(): Promise<void> {
  try {
    // Find ended conversations without sentiment analysis
    const query = {
      status: 'ended',
      $or: [
        { 'metadata.sentiment_analyzed_at': { $exists: false } },
        { 'metadata.sentiment_analyzed_at': null },
      ],
    }

    const conversations = await Conversation.find(query)
      .limit(BATCH_SIZE)
      .select('_id company_id')
      .lean()

    if (conversations.length === 0) {
      logger.debug('No unprocessed ended conversations found')
      return
    }

    logger.info('Processing ended conversations', {
      count: conversations.length,
    })

    // Group by company for better organization
    const conversationIds = conversations.map((c) => c._id.toString())

    const results = await batchProcessConversations(conversationIds, {
      analyzeThreading: true,
      analyzeSentiment: true,
    })

    logger.info('Batch processing completed', {
      processed: results.processed,
      threadingResults: results.threadingResults,
      sentimentResults: results.sentimentResults,
      errors: results.errors,
    })
  } catch (error) {
    logger.error('Error in scheduled analysis processing', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Start the scheduled processor
 */
export function startAnalysisProcessor(): void {
  if (processingInterval) {
    logger.warn('Analysis processor already running')
    return
  }

  logger.info('Starting analysis processor', {
    interval: `${PROCESS_INTERVAL_MS / 1000}s`,
    batchSize: BATCH_SIZE,
  })

  // Process immediately on start
  processEndedConversations().catch((error) => {
    logger.error('Error in initial analysis processing', { error })
  })

  // Then process on schedule
  processingInterval = setInterval(() => {
    processEndedConversations().catch((error) => {
      logger.error('Error in scheduled analysis processing', { error })
    })
  }, PROCESS_INTERVAL_MS)
}

/**
 * Stop the scheduled processor
 */
export function stopAnalysisProcessor(): void {
  if (processingInterval) {
    clearInterval(processingInterval)
    processingInterval = null
    logger.info('Analysis processor stopped')
  }
}

/**
 * Process specific conversations (for manual triggers)
 */
export async function processConversations(
  conversationIds: string[],
  options: {
    analyzeThreading?: boolean
    analyzeSentiment?: boolean
  } = {}
): Promise<{
  processed: number
  threadingResults: number
  sentimentResults: number
  errors: number
}> {
  return await batchProcessConversations(conversationIds, {
    analyzeThreading: options.analyzeThreading ?? true,
    analyzeSentiment: options.analyzeSentiment ?? true,
  })
}



