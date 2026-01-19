/**
 * Intent Detection Utility
 * Detects user intent from messages to improve agent responses
 */

import { getOpenAI } from '../services/openai.js'

// Intent categories
export type IntentCategory = 
  | 'question'      // User asking a question
  | 'complaint'    // User expressing dissatisfaction
  | 'request'      // User making a request
  | 'purchase'     // User showing purchase intent
  | 'support'      // User needs support/help
  | 'feedback'     // User providing feedback
  | 'greeting'     // User greeting
  | 'goodbye'      // User saying goodbye
  | 'other'        // Other/unclear intent

export interface IntentDetectionResult {
  intent: IntentCategory
  confidence: number
  reasoning?: string
}

/**
 * Detect intent from user message using OpenAI
 * 
 * Classifies the user's intent into categories like question, complaint, request, etc.
 * Uses GPT-4o-mini with JSON mode for consistent classification.
 * 
 * @param message - User message to analyze
 * @returns Intent detection result with category, confidence, and reasoning
 * @throws Error if OpenAI client is not available
 */
export async function detectIntent(message: string): Promise<IntentDetectionResult> {
  const openai = getOpenAI()
  if (!openai) {
    throw new Error('OpenAI client is not available. Cannot detect intent.')
  }

    const prompt = `Analyze the following user message and determine their intent. Respond with ONLY a JSON object in this exact format:
{
  "intent": "question|complaint|request|purchase|support|feedback|greeting|goodbye|other",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

User message: "${message}"

JSON response:`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an intent detection system. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent classification
      max_tokens: 150,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content?.trim()
    if (!responseText) {
      throw new Error('OpenAI returned empty response for intent detection')
    }
    
    const result = JSON.parse(responseText) as {
      intent?: string
      confidence?: number
      reasoning?: string
    }

    if (!result.intent) {
      throw new Error('OpenAI response missing intent field')
    }
    
    const intent = result.intent as IntentCategory
    const confidence = result.confidence !== undefined 
      ? Math.min(Math.max(result.confidence, 0), 1)
      : 0.5

    return {
      intent,
      confidence,
      reasoning: result.reasoning,
    }
}

/**
 * Get intent-based system prompt enhancement
 * 
 * Returns additional instructions for the AI based on detected intent.
 * Helps the agent respond more appropriately to different types of messages.
 * 
 * @param intent - Detected intent category
 * @returns Additional prompt text to enhance system prompt
 */
export function getIntentBasedPromptEnhancement(intent: IntentCategory): string {
  const enhancements: Record<IntentCategory, string> = {
    question: 'The user is asking a question. Provide a clear, helpful, and accurate answer.',
    complaint: 'The user has a complaint. Be empathetic, acknowledge their concern, and work towards a resolution.',
    request: 'The user is making a request. Be helpful and accommodating while staying within your capabilities.',
    purchase: 'The user shows purchase intent. Provide relevant product information and guide them through the process.',
    support: 'The user needs support. Provide step-by-step guidance and be patient with explanations.',
    feedback: 'The user is providing feedback. Listen actively, acknowledge their input, and thank them.',
    greeting: 'The user is greeting you. Respond warmly and offer assistance.',
    goodbye: 'The user is saying goodbye. End the conversation politely and offer future assistance.',
    other: 'Continue the conversation naturally based on context.',
  }

  return enhancements[intent] || enhancements.other
}

