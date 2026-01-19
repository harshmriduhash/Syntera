/**
 * LLM-based Contact Information Extractor
 * Uses OpenAI to extract and validate contact information with error detection
 */

import { getOpenAI } from '../services/openai.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:contact-extractor-llm')

export interface ExtractedContactInfo {
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  company_name?: string
  confidence?: number
  errors_detected?: string[]
  corrections_made?: Record<string, string>
}

/**
 * Extract contact information using LLM with structured output
 * This replaces regex-based heuristics with intelligent extraction
 */
export async function extractContactInfoLLM(
  messageText: string,
  conversationContext?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
): Promise<ExtractedContactInfo> {
  const openai = getOpenAI()
  if (!openai) {
    logger.warn('OpenAI not available, falling back to empty extraction')
    return {}
  }

  try {
    // Build context for better understanding
    const contextText = conversationContext
      ? conversationContext
          .slice(-5) // Last 5 messages for context
          .map((msg) => `${msg.role}: ${msg.content}`)
          .join('\n')
      : ''

    const prompt = `Extract contact information from the following message. Analyze the text carefully and extract any contact details mentioned.

CRITICAL REQUIREMENTS:
1. Extract email addresses - validate format and CORRECT common typos (e.g., "gmazil" -> "gmail", "gmial" -> "gmail", "yahooo" -> "yahoo")
2. Extract phone numbers - normalize to digits only (remove spaces, dashes, parentheses)
3. Extract names - identify first_name and last_name separately. Be careful not to extract random words as names (e.g., "interested about" is NOT a name)
4. Extract company names - only if explicitly mentioned as a company/organization
5. Detect and correct errors in contact information
6. Only extract information that is CLEARLY contact information, not random words from the conversation

Respond with ONLY a JSON object in this exact format:
{
  "email": "corrected-email@domain.com" or null,
  "phone": "digits-only-phone" or null,
  "first_name": "actual first name" or null,
  "last_name": "actual last name" or null,
  "company_name": "company name" or null,
  "confidence": 0.0 to 1.0,
  "errors_detected": ["list of errors found"],
  "corrections_made": {"original": "corrected"} or {}
}

IMPORTANT:
- If email has typos, correct them (e.g., "wambstephane@gmazil.com" -> "wambstephane@gmail.com")
- If name extraction is uncertain (confidence < 0.7), set to null
- Do NOT extract words like "interested", "about", "products" as names
- Only extract if you're confident it's actual contact information
- confidence should reflect how certain you are about the extraction

${contextText ? `\nConversation context:\n${contextText}\n` : ''}

Message to analyze: "${messageText}"

JSON response:`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a contact information extraction system. Extract and validate contact information from text. Always correct typos in emails and phone numbers. Respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent, accurate extraction
      max_tokens: 300,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content?.trim() || '{}'
    const result = JSON.parse(responseText) as {
      email?: string | null
      phone?: string | null
      first_name?: string | null
      last_name?: string | null
      company_name?: string | null
      confidence?: number
      errors_detected?: string[]
      corrections_made?: Record<string, string>
    }

    // Validate and clean the extracted data
    const extracted: ExtractedContactInfo = {}

    if (result.email && result.email !== 'null' && result.email.includes('@')) {
      extracted.email = result.email.toLowerCase().trim()
    }

    if (result.phone && result.phone !== 'null') {
      // Ensure phone is digits only
      const phoneDigits = result.phone.replace(/\D/g, '')
      if (phoneDigits.length >= 10) {
        extracted.phone = phoneDigits
      }
    }

    // Only include names if confidence is high enough
    if (result.first_name && result.first_name !== 'null' && (result.confidence || 0) >= 0.7) {
      extracted.first_name = result.first_name.trim()
    }

    if (result.last_name && result.last_name !== 'null' && (result.confidence || 0) >= 0.7) {
      extracted.last_name = result.last_name.trim()
    }

    if (result.company_name && result.company_name !== 'null') {
      extracted.company_name = result.company_name.trim()
    }

    if (result.confidence !== undefined) {
      extracted.confidence = result.confidence
    }

    if (result.errors_detected && result.errors_detected.length > 0) {
      extracted.errors_detected = result.errors_detected
    }

    if (result.corrections_made && Object.keys(result.corrections_made).length > 0) {
      extracted.corrections_made = result.corrections_made
    }

    logger.info('LLM extracted contact info', {
      extracted: Object.keys(extracted).filter((k) => k !== 'confidence' && k !== 'errors_detected' && k !== 'corrections_made'),
      confidence: extracted.confidence,
      errors: extracted.errors_detected,
      corrections: extracted.corrections_made,
    })

    return extracted
  } catch (error) {
    logger.error('Failed to extract contact info with LLM', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
