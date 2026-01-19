/**
 * Auto-Threading and Sentiment Analysis Service
 * Uses LLM to analyze conversations and create threads, analyze sentiment
 * Batch processed after conversations end or periodically
 */

import { createLogger } from '@syntera/shared/logger/index.js'
import { Conversation, Message } from '@syntera/shared/models/index.js'
import { generateResponse } from './openai.js'
import mongoose from 'mongoose'

const logger = createLogger('agent-service:threading-analyzer')

interface ThreadingAnalysisResult {
  threads: Array<{
    title: string
    startMessageIndex: number
    endMessageIndex: number
    messageIds: string[]
    topic: string
  }>
}

interface SentimentAnalysisResult {
  overallSentiment: 'positive' | 'neutral' | 'negative'
  sentimentScore: number // -1 to 1
  messageSentiments: Array<{
    messageId: string
    sentiment: 'positive' | 'neutral' | 'negative'
    score: number
    confidence: number
  }>
  sentimentTrend: 'improving' | 'declining' | 'stable'
}

/**
 * Analyze conversation and create threads using LLM
 */
export async function analyzeConversationThreading(
  conversationId: string,
  messages: Array<{ _id: string; content: string; role: string; created_at: Date }>
): Promise<ThreadingAnalysisResult | null> {
  if (!messages || messages.length < 3) {
    logger.debug('Not enough messages for threading analysis', { conversationId })
    return null
  }

  try {
    // Prepare conversation context for LLM
    const conversationText = messages
      .map((msg, idx) => `[${idx}] ${msg.role}: ${msg.content}`)
      .join('\n')

    const prompt = `Analyze this conversation and identify distinct topics or threads. 
Each thread should represent a coherent topic or subject that the conversation covers.

Conversation:
${conversationText}

Return a JSON object with this structure:
{
  "threads": [
    {
      "title": "Thread title (max 50 chars)",
      "startMessageIndex": 0,
      "endMessageIndex": 5,
      "topic": "Brief topic description",
      "messageIndices": [0, 1, 2, 3, 4, 5]
    }
  ]
}

Rules:
- Create threads only when there's a clear topic shift
- Threads can overlap (messages can be in multiple threads if relevant)
- Minimum 2 messages per thread
- Maximum 5-7 threads per conversation
- Thread titles should be concise and descriptive

Return ONLY valid JSON, no other text.`

    const response = await generateResponse({
      systemPrompt: 'You are an expert at analyzing conversations and identifying topics. Always return valid JSON.',
      userMessage: prompt,
      model: 'gpt-4o-mini', // Use cheaper model for analysis
      temperature: 0.3, // Lower temperature for more consistent analysis
      maxTokens: 2000,
    })

    if (!response.response) {
      logger.warn('No response from LLM for threading analysis', { conversationId })
      return null
    }

    // Parse LLM response
    let analysisResult: ThreadingAnalysisResult
    try {
      // Extract JSON from response (might have markdown code blocks)
      const jsonMatch = response.response.match(/```json\s*([\s\S]*?)\s*```/) || 
                       response.response.match(/\{[\s\S]*\}/)
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response.response
      analysisResult = JSON.parse(jsonText.trim())
    } catch (parseError) {
      logger.error('Failed to parse LLM threading response', {
        conversationId,
        error: parseError,
        response: response.response.substring(0, 200),
      })
      return null
    }

    // Map message indices to message IDs
    const threadsWithIds = analysisResult.threads.map((thread: any) => ({
      ...thread,
      messageIds: thread.messageIndices
        .map((idx: number) => messages[idx]?._id)
        .filter(Boolean),
    }))

    logger.info('Threading analysis completed', {
      conversationId,
      threadCount: threadsWithIds.length,
    })

    return {
      threads: threadsWithIds,
    }
  } catch (error) {
    logger.error('Failed to analyze conversation threading', {
      conversationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Analyze sentiment of conversation using LLM
 */
export async function analyzeConversationSentiment(
  conversationId: string,
  messages: Array<{ _id: string; content: string; role: string; created_at: Date }>
): Promise<SentimentAnalysisResult | null> {
  if (!messages || messages.length === 0) {
    return null
  }

  try {
    // Prepare conversation for sentiment analysis
    const userMessages = messages
      .filter((msg) => msg.role === 'user')
      .map((msg, idx) => `[${idx}] ${msg.content}`)
      .join('\n')

    const prompt = `Analyze the sentiment of this conversation. Focus on the user's messages to understand their emotional state and satisfaction.

User Messages:
${userMessages}

Return a JSON object with this structure:
{
  "overallSentiment": "positive" | "neutral" | "negative",
  "sentimentScore": 0.75,  // -1 (very negative) to 1 (very positive)
  "messageSentiments": [
    {
      "messageIndex": 0,
      "sentiment": "positive",
      "score": 0.8,
      "confidence": 0.9
    }
  ],
  "sentimentTrend": "improving" | "declining" | "stable"
}

Rules:
- sentimentScore: -1 (very negative) to 1 (very positive), 0 is neutral
- confidence: 0 to 1, how confident you are in the sentiment
- sentimentTrend: compare early vs late messages to determine trend
- Analyze each user message individually

Return ONLY valid JSON, no other text.`

    const response = await generateResponse({
      model: 'gpt-4o-mini',
      systemPrompt: 'You are an expert at sentiment analysis. Always return valid JSON with accurate sentiment scores.',
      userMessage: prompt,
      temperature: 0.2, // Very low temperature for consistent sentiment analysis
      maxTokens: 2000,
    })

    if (!response.response) {
      logger.warn('No response from LLM for sentiment analysis', { conversationId })
      return null
    }

    // Parse LLM response
    let analysisResult: SentimentAnalysisResult
    try {
      const jsonMatch = response.response.match(/```json\s*([\s\S]*?)\s*```/) || 
                       response.response.match(/\{[\s\S]*\}/)
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response.response
      analysisResult = JSON.parse(jsonText.trim())
    } catch (parseError) {
      logger.error('Failed to parse LLM sentiment response', {
        conversationId,
        error: parseError,
        response: response.response.substring(0, 200),
      })
      return null
    }

    // Map message indices to message IDs
    const userMessageIds = messages
      .filter((msg) => msg.role === 'user')
      .map((msg) => msg._id.toString())

    const messageSentimentsWithIds = analysisResult.messageSentiments.map(
      (sentiment: any) => ({
        messageId: userMessageIds[sentiment.messageIndex] || '',
        sentiment: sentiment.sentiment,
        score: sentiment.score,
        confidence: sentiment.confidence,
      })
    )

    logger.info('Sentiment analysis completed', {
      conversationId,
      overallSentiment: analysisResult.overallSentiment,
      sentimentScore: analysisResult.sentimentScore,
    })

    return {
      overallSentiment: analysisResult.overallSentiment,
      sentimentScore: analysisResult.sentimentScore,
      messageSentiments: messageSentimentsWithIds,
      sentimentTrend: analysisResult.sentimentTrend,
    }
  } catch (error) {
    logger.error('Failed to analyze conversation sentiment', {
      conversationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Batch process conversations for threading and sentiment
 */
export async function batchProcessConversations(
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
  const results = {
    processed: 0,
    threadingResults: 0,
    sentimentResults: 0,
    errors: 0,
  }

  for (const conversationId of conversationIds) {
    try {
      // Fetch conversation and messages
      const conversation = await Conversation.findById(conversationId).lean()
      if (!conversation) {
        logger.warn('Conversation not found for batch processing', { conversationId })
        continue
      }

      const messages = await Message.find({
        conversation_id: conversationId,
      })
        .sort({ created_at: 1 })
        .lean()

      if (messages.length === 0) {
        logger.debug('No messages found for conversation', { conversationId })
        continue
      }

      // Analyze threading if enabled
      if (options.analyzeThreading) {
        const threadingResult = await analyzeConversationThreading(
          conversationId,
          messages as any
        )

        if (threadingResult && threadingResult.threads.length > 0) {
          // Create threads in database
          const threads = threadingResult.threads.map((thread) => ({
            id: new mongoose.Types.ObjectId().toString(),
            title: thread.title,
            created_at: new Date(),
            message_count: thread.messageIds.length,
          }))

          // Update conversation with threads
          await Conversation.findByIdAndUpdate(conversationId, {
            $set: { threads },
          })

          // Update messages with thread IDs
          for (const thread of threadingResult.threads) {
            await Message.updateMany(
              {
                _id: { $in: thread.messageIds },
                conversation_id: conversationId,
              },
              {
                $set: { thread_id: threads.find((t) => t.title === thread.title)?.id },
              }
            )
          }

          results.threadingResults++
          logger.info('Threads created from analysis', {
            conversationId,
            threadCount: threads.length,
          })
        }
      }

      // Analyze sentiment if enabled
      if (options.analyzeSentiment) {
        const sentimentResult = await analyzeConversationSentiment(
          conversationId,
          messages as any
        )

        if (sentimentResult) {
          // Update conversation metadata with sentiment
          await Conversation.findByIdAndUpdate(conversationId, {
            $set: {
              'metadata.overall_sentiment': sentimentResult.overallSentiment,
              'metadata.sentiment_score': sentimentResult.sentimentScore,
              'metadata.sentiment_trend': sentimentResult.sentimentTrend,
              'metadata.sentiment_analyzed_at': new Date(),
            },
          })

          // Update individual messages with sentiment
          for (const msgSentiment of sentimentResult.messageSentiments) {
            if (msgSentiment.messageId) {
              await Message.findByIdAndUpdate(msgSentiment.messageId, {
                $set: {
                  'metadata.sentiment': msgSentiment.sentiment,
                  'metadata.sentiment_score': msgSentiment.score,
                  'metadata.sentiment_confidence': msgSentiment.confidence,
                },
              })
            }
          }

          results.sentimentResults++
          logger.info('Sentiment analysis saved', {
            conversationId,
            sentiment: sentimentResult.overallSentiment,
            score: sentimentResult.sentimentScore,
          })
        }
      }

      results.processed++
    } catch (error) {
      results.errors++
      logger.error('Error processing conversation in batch', {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return results
}

