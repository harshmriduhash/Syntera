/**
 * Analytics Overview API
 * 
 * Provides key performance indicators (KPIs) including:
 * - Total and active conversation counts
 * - Active agent count
 * - Average response time
 * - User satisfaction score
 * 
 * @route GET /api/analytics/overview
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'http://localhost:4004'

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, ctx) => {
    try {
      if (!ctx.companyId) {
        return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
      }

      const supabase = await createClient()
      const searchParams = req.nextUrl.searchParams
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')

      // Get access token for Chat Service
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        return NextResponse.json({ error: 'No session token' }, { status: 401 })
      }

      // Fetch conversations from Chat Service
      const convParams = new URLSearchParams()
      if (startDate) convParams.append('startDate', startDate)
      if (endDate) convParams.append('endDate', endDate)

      const conversationsResponse = await fetch(
        `${CHAT_SERVICE_URL}/api/conversations?${convParams.toString()}&limit=1000`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )

      if (!conversationsResponse.ok) {
        throw new Error('Failed to fetch conversations')
      }

      const conversationsData = await conversationsResponse.json()
      const conversations = conversationsData.conversations || []

      // Calculate conversation metrics
      const totalConversations = conversations.length
      const activeConversations = conversations.filter(
        (c: { status: string }) => c.status === 'active'
      ).length

      // Retrieve active agent count from Supabase
      const { data: agents, error: agentsError } = await supabase
        .from('agent_configs')
        .select('id')
        .eq('company_id', ctx.companyId)
        .eq('enabled', true)

      if (agentsError) {
        logger.warn('Failed to retrieve agent count for analytics', {
          error: agentsError.message,
          companyId: ctx.companyId,
        })
      }

      const activeAgents = agents?.length || 0

      // Fetch message data to calculate performance metrics
      const messagesResponse = await fetch(
        `${CHAT_SERVICE_URL}/api/internal/messages/list`,
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

      let avgResponseTime = 0
      let userSatisfaction = 0

      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json()
        const messages = messagesData.messages || []

        // Calculate average response time from agent messages with timing metadata
        const agentMessages = messages.filter(
          (m: { sender_type: string; ai_metadata?: { response_time_ms?: number } }) =>
            m.sender_type === 'agent' && m.ai_metadata?.response_time_ms
        )

        if (agentMessages.length > 0) {
          const totalResponseTime = agentMessages.reduce(
            (sum: number, m: { ai_metadata: { response_time_ms: number } }) =>
              sum + (m.ai_metadata.response_time_ms || 0),
            0
          )
          avgResponseTime = Math.round(totalResponseTime / agentMessages.length)
        }

        // Calculate user satisfaction percentage from sentiment analysis
        const messagesWithSentiment = messages.filter(
          (m: { metadata?: { sentiment?: { sentiment: string } } }) =>
            m.metadata?.sentiment?.sentiment
        )

        if (messagesWithSentiment.length > 0) {
          const positiveCount = messagesWithSentiment.filter(
            (m: { metadata: { sentiment: { sentiment: string } } }) =>
              m.metadata.sentiment.sentiment === 'positive'
          ).length
          userSatisfaction = Math.round((positiveCount / messagesWithSentiment.length) * 100)
        }
      }

      return NextResponse.json({
        totalConversations,
        activeConversations,
        activeAgents,
        avgResponseTime,
        userSatisfaction,
      })
    } catch (error) {
      logger.error('Failed to fetch analytics overview metrics', {
        error: error instanceof Error ? error.message : String(error),
        companyId: ctx.companyId,
      })
      return NextResponse.json(
        { error: 'Failed to fetch analytics overview' },
        { status: 500 }
      )
    }
  }, { requireCompany: true })
}