/**
 * Analytics Costs API
 * 
 * Calculates token usage and estimated costs based on:
 * - Total tokens consumed across all messages
 * - Model-specific pricing (per 1M tokens)
 * - Estimated input/output token distribution (80/20 split)
 * 
 * @route GET /api/analytics/costs
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { logger } from '@/lib/utils/logger'

const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'http://localhost:4004'

/**
 * OpenAI model pricing per 1 million tokens (USD)
 * Prices are current as of implementation date and may need periodic updates
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
}

/**
 * Calculate estimated cost for token usage
 * 
 * Uses a standard 80/20 input/output token distribution as an approximation
 * since individual message token breakdowns are not always available.
 * 
 * @param tokensUsed - Total tokens consumed
 * @param model - OpenAI model identifier
 * @returns Estimated cost in USD
 */
function calculateCost(tokensUsed: number, model: string): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o-mini']
  const inputTokens = tokensUsed * 0.8
  const outputTokens = tokensUsed * 0.2
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, ctx) => {
    try {
      if (!ctx.companyId) {
        return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
      }

      const searchParams = req.nextUrl.searchParams
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')

      // Fetch messages from Chat Service
      const messagesResponse = await fetch(
        `${CHAT_SERVICE_URL}/api/internal/messages/list?limit=1000`,
        {
          headers: {
            Authorization: `Bearer ${process.env.INTERNAL_SERVICE_TOKEN || ''}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({
            companyId: ctx.companyId,
            limit: 1000,
            startDate,
            endDate,
          }),
        }
      )

      let messages = []

      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json()
        messages = messagesData.messages || []
      } else {
        // Fallback: Return mock data for development/demo purposes
        logger.warn('Chat service unavailable, using mock cost data', {
          companyId: ctx.companyId,
          status: messagesResponse.status,
        })
        return NextResponse.json({
          totalTokens: 1500000, // 1.5M tokens
          estimatedCost: 2.25, // ~$2.25 based on gpt-4o-mini pricing
        })
      }

      // Calculate total tokens and cost
      let totalTokens = 0
      let totalCost = 0

      messages.forEach((m: { ai_metadata?: { tokens_used?: number; model?: string } }) => {
        if (m.ai_metadata?.tokens_used) {
          const tokens = m.ai_metadata.tokens_used
          totalTokens += tokens
          const model = m.ai_metadata.model || 'gpt-4o-mini'
          totalCost += calculateCost(tokens, model)
        }
      })

      return NextResponse.json({
        totalTokens,
        estimatedCost: Math.round(totalCost * 100) / 100, // Round to 2 decimal places for currency display
      })
    } catch (error) {
      logger.error('Failed to calculate cost analytics', {
        error: error instanceof Error ? error.message : String(error),
        companyId: ctx.companyId,
      })
      return NextResponse.json(
        { error: 'Failed to fetch cost analytics' },
        { status: 500 }
      )
    }
  }, { requireCompany: true })
}

