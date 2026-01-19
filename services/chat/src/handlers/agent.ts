/**
 * Agent Integration Handler
 * Handles AI agent responses to user messages
 */

import { Server } from 'socket.io'
import { AuthenticatedSocket } from '../middleware/auth.js'
import { Message, Conversation } from '@syntera/shared/models'
import { createLogger } from '@syntera/shared/logger/index.js'
import { invalidateConversationCache, invalidateMessagesCache } from '../utils/cache.js'
// Constants for summarization
const SUMMARY_THRESHOLD = 30 // Summarize when conversation has 30+ messages
const SUMMARY_INTERVAL = 20 // Update summary every 20 new messages

/**
 * Check if conversation should be summarized
 */
function shouldSummarizeConversation(messageCount: number, lastSummaryCount?: number): boolean {
  if (messageCount >= SUMMARY_THRESHOLD) {
    if (!lastSummaryCount) {
      return true // First summary
    }
    return messageCount - lastSummaryCount >= SUMMARY_INTERVAL
  }
  return false
}

/**
 * Optimize conversation history using summary
 */
function optimizeConversationHistory(
  allMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  summary?: string,
  summaryMessageCount?: number
): {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  summary: string | undefined
} {
  if (summary && summaryMessageCount && allMessages.length > SUMMARY_THRESHOLD) {
    const recentMessages = allMessages.slice(-10)
    return {
      messages: recentMessages,
      summary,
    }
  }
  // Return last 30 messages if no summary (increased from 20 for better context)
  return {
    messages: allMessages.slice(-30),
    summary: undefined,
  }
}

/**
 * Format conversation history with summary for OpenAI
 */
function formatConversationWithSummary(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  summary?: string
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  const formatted: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

  if (summary) {
    formatted.push({
      role: 'system',
      content: `Previous conversation summary: ${summary}\n\nContinue the conversation based on this context.`,
    })
  }

  for (const msg of messages) {
    formatted.push({
      role: msg.role,
      content: msg.content,
    })
  }

  return formatted
}

const logger = createLogger('chat-service:agent')

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL
if (!AGENT_SERVICE_URL) {
  throw new Error('AGENT_SERVICE_URL environment variable is required')
}

/**
 * Generate AI agent response to a user message
 */
export async function generateAgentResponse(
  io: Server,
  conversationId: string,
  userMessage: string,
  agentId: string,
  companyId: string,
  userToken: string,
  attachments?: Array<{ url: string; type: string; name: string; size?: number }>,
  threadId?: string
) {
  try {
    // Get conversation to check for summary and metadata
    const conversation = await Conversation.findById(conversationId).lean()
    
    // Extract contact info from conversation metadata
    const conversationMetadata = conversation?.metadata || {}
    const collectedContactInfo: {
      email?: string
      phone?: string
      first_name?: string
      last_name?: string
      name?: string
    } = {}
    
    if (conversationMetadata.email) collectedContactInfo.email = conversationMetadata.email as string
    if (conversationMetadata.phone) collectedContactInfo.phone = conversationMetadata.phone as string
    if (conversationMetadata.first_name) collectedContactInfo.first_name = conversationMetadata.first_name as string
    if (conversationMetadata.last_name) collectedContactInfo.last_name = conversationMetadata.last_name as string
    if (conversationMetadata.first_name || conversationMetadata.last_name) {
      collectedContactInfo.name = [conversationMetadata.first_name, conversationMetadata.last_name]
        .filter(Boolean)
        .join(' ')
    }
    
    // Get all messages for summarization check
    // Exclude the current user message (most recent one) from history since it will be added separately
    const allMessages = await Message.find({
      conversation_id: conversationId,
    })
      .select('content role sender_type attachments created_at')
      .sort({ created_at: 1 }) // Sort chronologically for summarization
      .lean()

    const messageCount = allMessages.length
    
    // Exclude the most recent message if it's a user message matching the current userMessage
    // This prevents duplicate messages in the conversation history
    // Compare by trimming whitespace to handle any formatting differences
    const lastMessage = allMessages.length > 0 ? allMessages[allMessages.length - 1] : null
    const isCurrentMessage = lastMessage && 
                             lastMessage.content?.trim() === userMessage.trim() &&
                             (lastMessage.sender_type === 'user' || lastMessage.role === 'user')
    
    const messagesForHistory = isCurrentMessage 
      ? allMessages.slice(0, -1) // Exclude last message (current user message)
      : allMessages // Keep all if it doesn't match

    // Check if we should summarize
    let shouldSummarize = false
    if (conversation && shouldSummarizeConversation(messageCount, conversation.summary_message_count)) {
      shouldSummarize = true
    }

    // Generate summary if needed
    if (shouldSummarize && conversation) {
      try {
        // Format messages for summarization (exclude system messages)
        // Use messagesForHistory to avoid including current message in summary
        const messagesForSummary = messagesForHistory
          .filter((msg: any) => {
            // Exclude system messages based on role or sender_type
            const role = msg.role || (msg.sender_type === 'agent' ? 'assistant' : msg.sender_type === 'user' ? 'user' : 'system')
            return role !== 'system'
          })
          .map((msg: any) => {
            let content = msg.content
            if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
              const attachmentInfo = msg.attachments.map((att: any) => 
                `[Attachment: ${att.name}]`
              ).join(', ')
              content = `${content} (${attachmentInfo})`
            }
            // Map role correctly for summarization
            let role: 'user' | 'assistant' = 'user'
            if (msg.sender_type === 'agent' || msg.role === 'assistant' || msg.role === 'agent') {
              role = 'assistant'
            } else if (msg.sender_type === 'user' || msg.role === 'user') {
              role = 'user'
            }
            return {
              role,
              content,
            }
          })

        // Generate summary using Agent Service
        const summaryResponse = await fetch(`${AGENT_SERVICE_URL}/api/responses/summarize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            messages: messagesForSummary,
          }),
        })

        if (summaryResponse.ok) {
          const { summary } = await summaryResponse.json() as { summary: string }
          
          // Update conversation with summary
          await Conversation.findByIdAndUpdate(conversationId, {
            summary,
            summary_updated_at: new Date(),
            summary_message_count: messageCount,
          })

        }
      } catch (summaryError) {
        logger.warn('Failed to generate conversation summary', { error: summaryError })
        // Continue without summary
      }
    }

    // Get updated conversation with summary
    const updatedConversation = await Conversation.findById(conversationId).lean()

    // Optimize conversation history (use summary if available)
    // Get last 50 messages for better context (increased from 30)
    // Use messagesForHistory which excludes the current user message
    const recentMessages = messagesForHistory.slice(-50)
    const optimized = optimizeConversationHistory(
      recentMessages.map((msg: any) => {
        let content = msg.content
        if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
          const attachmentInfo = msg.attachments.map((att: any) => 
            `[Attachment: ${att.name} (${att.type}) - ${att.url}]`
          ).join('\n')
          content = `${content}\n\nAttachments:\n${attachmentInfo}`
        }
        // Map role correctly: use sender_type if role is not set or is 'agent'
        let role: 'user' | 'assistant' | 'system' = msg.role as 'user' | 'assistant' | 'system'
        if (!msg.role || msg.role === 'agent') {
          // Map from sender_type if role is missing or incorrect
          if (msg.sender_type === 'agent') {
            role = 'assistant'
          } else if (msg.sender_type === 'user') {
            role = 'user'
          } else if (msg.sender_type === 'system') {
            role = 'system'
          } else {
            role = (msg.role || 'user') as 'user' | 'assistant' | 'system'
          }
        }
        return {
          role,
          content,
        }
      }),
      updatedConversation?.summary,
      updatedConversation?.summary_message_count
    )

    // Format conversation history for OpenAI
    const conversationHistory = formatConversationWithSummary(
      optimized.messages,
      optimized.summary
    )

    logger.debug('Conversation history for agent response', {
      conversationId,
      historyLength: conversationHistory.length,
      lastFewMessages: conversationHistory.slice(-5).map(m => ({ role: m.role, contentPreview: m.content.substring(0, 50) })),
      hasSummary: !!optimized.summary,
    })

    // Call Agent Service to generate response
    // Include conversationId so agent service can load metadata and know what contact info has been collected
    const response = await fetch(`${AGENT_SERVICE_URL}/api/responses/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        agentId,
        conversationId, // Pass conversationId so agent service can load metadata
        message: attachments && attachments.length > 0
          ? `${userMessage}\n\n[User has attached ${attachments.length} file(s): ${attachments.map(a => a.name).join(', ')}]`
          : userMessage,
        conversationHistory,
        includeKnowledgeBase: true,
        attachments: attachments,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to generate response' })) as { error?: string }
      throw new Error(errorData.error || 'Failed to generate agent response')
    }

    const result = await response.json() as {
      response: string
      metadata: {
        agentId: string
        model: string
        tokensUsed: number
        knowledgeBaseUsed: boolean
        intent?: {
          category: string
          confidence: number
        }
        sentiment?: {
          sentiment: string
          score: number
          confidence: number
          emotions?: string[]
        }
      }
    }

    // Create agent message in database
    const agentMessage = await Message.create({
      conversation_id: conversationId,
      thread_id: threadId,
      sender_type: 'agent',
      role: 'assistant',
      content: result.response,
      message_type: 'text',
      ai_metadata: {
        model: result.metadata.model,
        tokens_used: result.metadata.tokensUsed,
        response_time_ms: Date.now(),
      },
      metadata: {
        ...(result.metadata.intent ? {
          intent: {
            category: result.metadata.intent.category,
            confidence: result.metadata.intent.confidence,
          },
        } : {}),
        ...(result.metadata.sentiment ? {
          sentiment: {
            sentiment: result.metadata.sentiment.sentiment,
            score: result.metadata.sentiment.score,
            confidence: result.metadata.sentiment.confidence,
            emotions: result.metadata.sentiment.emotions,
          },
        } : {}),
      },
    })

    // Update thread message count if message is in a thread
    if (threadId) {
      try {
        // Reload conversation to get latest threads (in case threads were added/updated)
        const updatedConversation = await Conversation.findOne({
          _id: conversationId,
          company_id: companyId,
        })
        if (updatedConversation && updatedConversation.threads) {
          const thread = updatedConversation.threads.find(t => String(t.id) === String(threadId))
        if (thread) {
            const oldCount = thread.message_count || 0
            thread.message_count = oldCount + 1
            // Mark threads array as modified for Mongoose to detect changes
            updatedConversation.markModified('threads')
            await updatedConversation.save()
          // Emit updated thread to clients
          io.to(`conversation:${conversationId}`).emit('thread:updated', {
            threadId,
            conversationId,
            message_count: thread.message_count,
          })
          } else {
            logger.warn('Thread not found when updating message count (agent response)', {
              threadId,
              conversationId,
              companyId,
              availableThreadIds: updatedConversation.threads.map(t => String(t.id)),
            })
          }
        } else {
          logger.warn('Conversation or threads not found when updating message count (agent response)', {
            threadId,
            conversationId,
            companyId,
            hasConversation: !!updatedConversation,
            hasThreads: !!updatedConversation?.threads,
          })
        }
      } catch (error) {
        logger.error('Error updating thread message count (agent response)', {
          error: error instanceof Error ? error.message : String(error),
          threadId,
          conversationId,
          companyId,
        })
      }
    }

    await invalidateMessagesCache(conversationId, threadId)

    io.to(`conversation:${conversationId}`).emit('message', {
      _id: String(agentMessage._id),
      conversation_id: conversationId,
      thread_id: threadId,
      sender_type: 'agent',
      role: 'assistant',
      content: result.response,
      message_type: 'text',
      ai_metadata: {
        model: result.metadata.model,
        tokens_used: result.metadata.tokensUsed,
        response_time_ms: Date.now(),
      },
      metadata: agentMessage.metadata || {},
      created_at: agentMessage.created_at.toISOString(),
    })

  } catch (error) {
    logger.error('Error generating agent response', { error, conversationId, agentId })
    
    // Send error message to user
    const errorMessage = await Message.create({
      conversation_id: conversationId,
      sender_type: 'system',
      role: 'system',
      content: 'Sorry, I encountered an error. Please try again.',
      message_type: 'system',
    })

    io.to(`conversation:${conversationId}`).emit('message', {
      _id: String(errorMessage._id),
      conversation_id: conversationId,
      sender_type: 'system',
      role: 'system',
      content: errorMessage.content,
      message_type: 'system',
      created_at: errorMessage.created_at.toISOString(),
    })

    throw error
  }
}
