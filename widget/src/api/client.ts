/**
 * API Client for Syntera Widget
 * Handles all HTTP requests to Syntera backend
 */

import type {
  Agent,
  Conversation,
  Message,
  CreateConversationInput,
  SendMessageInput,
  LiveKitTokenResponse,
  WebSocketConfig,
} from '../types'
import { logger } from '../utils/logger'

export class APIClient {
  private baseUrl: string
  private apiKey: string

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = apiKey
  }

  /**
   * Get agent configuration
   */
  async getAgent(agentId: string): Promise<Agent | null> {
    try {
      // Add cache-busting query parameter to ensure fresh data
      const response = await fetch(`${this.baseUrl}/api/public/agents/${agentId}?t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Prevent browser caching
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `Failed to fetch agent: ${response.status} ${response.statusText}`
        try {
          const errorData = JSON.parse(errorText)
          errorMessage += ` - ${errorData.error || errorText}`
        } catch {
          errorMessage += ` - ${errorText}`
        }
        logger.error('Agent API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          url: `${this.baseUrl}/api/public/agents/${agentId}`,
        })
        throw new Error(errorMessage)
      }

      const agent = await response.json()
      logger.info('Agent fetched:', { id: agent.id, name: agent.name, hasAvatar: !!agent.avatar_url })
      return agent
    } catch (error) {
      logger.error('Failed to get agent:', {
        error: error instanceof Error ? error.message : String(error),
        agentId,
        apiUrl: this.baseUrl,
      })
      return null
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const response = await fetch(`${this.baseUrl}/api/public/conversations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.statusText}`)
    }

    const data = await response.json()
    return data.conversation
  }

  /**
   * Send a message
   */
  async sendMessage(input: SendMessageInput): Promise<Message> {
    const body: Record<string, unknown> = {
      conversationId: input.conversationId,
      content: input.content,
    }

    if (input.threadId) {
      body.threadId = input.threadId
    }

    // TODO: Add attachment support to public API when backend is ready
    // if (input.attachments) {
    //   body.attachments = input.attachments
    // }

    const response = await fetch(`${this.baseUrl}/api/public/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`)
    }

    const data = await response.json()
    return data.message
  }

  /**
   * Get LiveKit token for voice/video calls
   */
  async getLiveKitToken(params: {
    conversationId: string
    agentId: string
  }): Promise<LiveKitTokenResponse> {
    const response = await fetch(`${this.baseUrl}/api/public/livekit/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      throw new Error(`Failed to get LiveKit token: ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Get WebSocket configuration
   */
  async getWebSocketConfig(conversationId: string): Promise<WebSocketConfig> {
    const response = await fetch(`${this.baseUrl}/api/public/websocket/config`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId }),
    })

    if (!response.ok) {
      throw new Error(`Failed to get WebSocket config: ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Update conversation (e.g., status, ended_at)
   */
  async updateConversation(
    conversationId: string,
    data: { status?: string; ended_at?: string }
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/public/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`Failed to update conversation: ${response.statusText}`)
    }
  }

  /**
   * Dispatch voice agent to a LiveKit room
   */
  async dispatchAgent(params: {
    conversationId: string
    agentId: string
  }): Promise<{ success: boolean; agentJobId?: string; message?: string }> {
    const response = await fetch(`${this.baseUrl}/api/public/voice-bot/deploy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to dispatch agent: ${errorText}`)
    }

    return await response.json()
  }
}

