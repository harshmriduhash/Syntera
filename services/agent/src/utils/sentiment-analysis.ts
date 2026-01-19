/**
 * Sentiment Analysis Utility
 * Analyzes emotional tone of messages to improve agent responses and track customer satisfaction
 */

import { getOpenAI } from '../services/openai.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:sentiment-analysis')

// Sentiment categories
export type SentimentCategory = 
  | 'positive'    // Happy, satisfied, pleased
  | 'negative'   // Angry, frustrated, disappointed
  | 'neutral'    // Neutral, factual, no strong emotion
  | 'mixed'      // Mixed emotions

export interface SentimentAnalysisResult {
  sentiment: SentimentCategory
  score: number // -1.0 (very negative) to +1.0 (very positive)
  emotions?: string[] // Detected emotions (e.g., ['frustrated', 'disappointed'])
  confidence: number // 0.0 to 1.0
  reasoning?: string
}

/**
 * Analyze sentiment and emotional tone from a message using OpenAI
 * 
 * Determines if the message is positive, negative, neutral, or mixed.
 * Also extracts specific emotions and provides a sentiment score (-1 to 1).
 * Uses GPT-4o-mini with JSON mode for consistent analysis.
 * 
 * @param message - Message text to analyze
 * @returns Sentiment analysis result with sentiment, score, emotions, and confidence
 * @throws Error if OpenAI client is not available
 */
export async function analyzeSentiment(message: string): Promise<SentimentAnalysisResult> {
  const openai = getOpenAI()
  if (!openai) {
    throw new Error('OpenAI client is not available. Cannot analyze sentiment.')
  }

  const prompt = `Analyze the sentiment and emotional tone of the following message. Respond with ONLY a JSON object in this exact format:
{
  "sentiment": "positive|negative|neutral|mixed",
  "score": -1.0 to 1.0,
  "emotions": ["emotion1", "emotion2"],
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}

Message: "${message}"

JSON response:`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a sentiment analysis system. Always respond with valid JSON only. Analyze the emotional tone accurately.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3, // Lower temperature for more consistent analysis
    max_tokens: 200,
    response_format: { type: 'json_object' },
  })

  const responseText = completion.choices[0]?.message?.content?.trim()
  if (!responseText) {
    throw new Error('OpenAI returned empty response for sentiment analysis')
  }
  
  const result = JSON.parse(responseText) as {
    sentiment?: string
    score?: number
    emotions?: string[]
    confidence?: number
    reasoning?: string
  }

  if (!result.sentiment) {
    throw new Error('OpenAI response missing sentiment field')
  }
  
  const sentiment = result.sentiment as SentimentCategory
  const score = result.score !== undefined
    ? Math.min(Math.max(result.score, -1), 1)
    : 0
  const confidence = result.confidence !== undefined
    ? Math.min(Math.max(result.confidence, 0), 1)
    : 0.5
  const emotions = result.emotions || []

  return {
    sentiment,
    score,
    emotions,
    confidence,
    reasoning: result.reasoning,
  }
}

/**
 * Get sentiment-based system prompt enhancement
 * 
 * Returns additional instructions for the AI based on detected sentiment.
 * Helps the agent adjust its tone and approach based on customer emotions.
 * 
 * @param sentiment - Detected sentiment category
 * @param score - Sentiment score (-1 to 1, where -1 is very negative, 1 is very positive)
 * @returns Additional prompt text to enhance system prompt
 */
export function getSentimentBasedPromptEnhancement(sentiment: SentimentCategory, score: number): string {
  if (sentiment === 'negative' && score < -0.5) {
    return 'The user is expressing strong negative sentiment. Be empathetic, acknowledge their frustration, and prioritize resolving their concern. Use a calm, understanding tone.'
  } else if (sentiment === 'negative') {
    return 'The user shows some dissatisfaction. Be understanding and helpful, focusing on addressing their concerns.'
  } else if (sentiment === 'positive' && score > 0.5) {
    return 'The user is expressing positive sentiment. Match their enthusiasm while remaining professional and helpful.'
  } else if (sentiment === 'positive') {
    return 'The user seems satisfied. Continue providing helpful, friendly assistance.'
  } else if (sentiment === 'mixed') {
    return 'The user has mixed feelings. Be balanced in your response, addressing both positive and negative aspects.'
  }
  
  return '' // Neutral sentiment doesn't need enhancement
}









