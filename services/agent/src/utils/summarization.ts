/**
 * Conversation Summarization Utility
 * Summarizes conversations to manage context window and reduce token usage
 */

import { getOpenAI } from '../services/openai.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:summarization')

// Constants
const SUMMARY_THRESHOLD = 30 // Summarize when conversation has 30+ messages
const SUMMARY_INTERVAL = 20 // Update summary every 20 new messages
const MAX_SUMMARY_LENGTH = 500 // Maximum summary length in characters

export interface ConversationSummary {
  summary: string
  messageCount: number
  updatedAt: Date
}

/**
 * Generate a summary of conversation messages
 */
export async function generateConversationSummary(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const openai = getOpenAI()
  if (!openai) {
    throw new Error('OpenAI client not initialized')
  }

  if (messages.length === 0) {
    return ''
  }

  try {
    // Format messages for summarization
    const conversationText = messages
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n')

    // Create summarization prompt
    const summaryPrompt = `Please provide a concise summary of the following conversation. Focus on:
1. Main topics discussed
2. Key questions asked by the user
3. Important information provided
4. Any decisions or conclusions reached

Keep the summary under ${MAX_SUMMARY_LENGTH} characters.

Conversation:
${conversationText}

Summary:`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates concise conversation summaries.',
        },
        {
          role: 'user',
          content: summaryPrompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more factual summaries
      max_tokens: 250,
    })

    const summary = completion.choices[0]?.message?.content?.trim() || ''
    
    logger.info('Generated conversation summary', {
      messageCount: messages.length,
      summaryLength: summary.length,
    })

    return summary
  } catch (error) {
    logger.error('Failed to generate conversation summary', { error })
    throw error
  }
}