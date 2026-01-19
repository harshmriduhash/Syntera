/**
 * Analytics Agents API
 * 
 * Provides agent performance metrics including:
 * - Conversation count per agent
 * - Average response time
 * - User satisfaction score
 * 
 * Results are sorted by conversation count (top performers first).
 * 
 * @route GET /api/analytics/agents
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

      // Get agents from Supabase
      const { data: agents, error: agentsError } = await supabase
        .from('agent_configs')
        .select('id, name, enabled')
        .eq('company_id', ctx.companyId)
        .eq('enabled', true)

      if (agentsError) {
        logger.warn('Failed to retrieve agent list for analytics', {
          error: agentsError.message,
          companyId: ctx.companyId,
        })
      }

      if (!agents || agents.length === 0) {
        return NextResponse.json({ agents: [] })
      }

      // Get access token for Chat Service
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        return NextResponse.json({ error: 'No session token' }, { status: 401 })
      }

      // Fetch conversations from Chat Service
      const conversationsResponse = await fetch(
        `${CHAT_SERVICE_URL}/api/conversations?limit=1000`,
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
      let conversations = conversationsData.conversations || []

      // Filter by date range if provided
      if (startDate || endDate) {
        conversations = conversations.filter((conv: { started_at: string }) => {
          const convDate = new Date(conv.started_at)
          if (startDate && convDate < new Date(startDate)) return false
          if (endDate && convDate > new Date(endDate)) return false
          return true
        })
      }

      // Fetch messages for response time and satisfaction
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

      const messages = messagesResponse.ok
        ? (await messagesResponse.json()).messages || []
        : []

      // Calculate performance metrics for each agent
      const agentMetrics = agents.map((agent) => {
        // Filter conversations assigned to this agent
        const agentConversations = conversations.filter(
          (c: { agent_id: string }) => c.agent_id === agent.id
        )

        // Filter messages from this agent's conversations
        const agentMessages = messages.filter(
          (m: { conversation_id: string; sender_type: string; ai_metadata?: { response_time_ms?: number }; metadata?: { sentiment?: { sentiment: string } } }) => {
            const conv = conversations.find((c: { _id: string; agent_id: string }) => 
              String(c._id) === m.conversation_id && c.agent_id === agent.id
            )
            return conv && m.sender_type === 'agent'
          }
        )

        // Calculate average response time from messages with timing metadata
        const messagesWithResponseTime = agentMessages.filter(
          (m: { ai_metadata?: { response_time_ms?: number } }) => m.ai_metadata?.response_time_ms
        )
        const avgResponseTime =
          messagesWithResponseTime.length > 0
            ? Math.round(
                messagesWithResponseTime.reduce(
                  (sum: number, m: { ai_metadata: { response_time_ms: number } }) =>
                    sum + (m.ai_metadata.response_time_ms || 0),
                  0
                ) / messagesWithResponseTime.length
              )
            : 0

        // Calculate satisfaction score from sentiment analysis
        const messagesWithSentiment = agentMessages.filter(
          (m: { metadata?: { sentiment?: { sentiment: string } } }) =>
            m.metadata?.sentiment?.sentiment
        )
        const satisfaction =
          messagesWithSentiment.length > 0
            ? Math.round(
                (messagesWithSentiment.filter(
                  (m: { metadata: { sentiment: { sentiment: string } } }) =>
                    m.metadata.sentiment.sentiment === 'positive'
                ).length /
                  messagesWithSentiment.length) *
                  100
              )
            : 0

        return {
          agentId: agent.id,
          agentName: agent.name || 'Unnamed Agent',
          conversationCount: agentConversations.length,
          avgResponseTime,
          satisfaction,
        }
      })

      // Sort agents by conversation count (descending) to highlight top performers
      agentMetrics.sort((a, b) => b.conversationCount - a.conversationCount)

      return NextResponse.json({ agents: agentMetrics })
    } catch (error) {
      logger.error('Failed to fetch agent performance analytics', {
        error: error instanceof Error ? error.message : String(error),
        companyId: ctx.companyId,
      })
      return NextResponse.json(
        { error: 'Failed to fetch agent analytics' },
        { status: 500 }
      )
    }
  }, { requireCompany: true })
}

