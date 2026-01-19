/**
 * Conversation History Caching
 * Caches conversation messages in Redis to reduce database queries
 */

import { getRedis } from '../config/database.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { Message } from '@syntera/shared/models/index.js'

const logger = createLogger('agent-service:conversation-cache')

const CACHE_TTL = 5 * 60 // 5 minutes in seconds
const CACHE_KEY_PREFIX = 'conv:history:'

/**
 * Get conversation history from cache or database
 */
export async function getConversationHistory(
  conversationId: string,
  threadId: string | null = null,
  limit: number = 20
): Promise<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> {
  const redis = getRedis()
  const cacheKey = `${CACHE_KEY_PREFIX}${conversationId}${threadId ? `:${threadId}` : ''}`

  // Try to get from cache
  if (redis) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        const messages = JSON.parse(cached) as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
        // Return limited results if cache has more than requested
        return messages.slice(-limit)
      }
    } catch (error) {
      logger.warn('Failed to read conversation history from cache', { error, conversationId })
      // Continue to database lookup
    }
  }

  // Fetch from database
  try {
    const messages = await Message.find({
      conversation_id: conversationId,
      thread_id: threadId || { $exists: false },
    })
      .sort({ created_at: 1 })
      .limit(limit)
      .lean()

    // Build conversation history format
    const conversationHistory = messages.map(m => {
      const role = m.sender_type === 'agent' ? 'assistant' : m.role
      return {
        role: role as 'user' | 'assistant' | 'system',
        content: m.content,
      }
    })

    // Cache the result
    if (redis && conversationHistory.length > 0) {
      try {
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(conversationHistory))
      } catch (cacheError) {
        logger.warn('Failed to cache conversation history', { error: cacheError, conversationId })
      }
    }

    return conversationHistory
  } catch (error) {
    logger.error('Failed to fetch conversation history', { error, conversationId })
    throw error
  }
}

/**
 * Invalidate conversation history cache
 * Call this when a new message is added to the conversation
 */
export async function invalidateConversationHistory(
  conversationId: string,
  threadId: string | null = null
): Promise<void> {
  const redis = getRedis()
  if (!redis) {
    return
  }

  const cacheKey = `${CACHE_KEY_PREFIX}${conversationId}${threadId ? `:${threadId}` : ''}`
  try {
    await redis.del(cacheKey)
    logger.debug('Invalidated conversation history cache', { conversationId, threadId })
  } catch (error) {
    logger.warn('Failed to invalidate conversation history cache', { error, conversationId })
  }
}





