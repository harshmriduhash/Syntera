/**
 * Main Syntera Widget Class
 */

import { ChatInterface } from './ui/chat-interface'
import { APIClient } from './api/client'
import { WebSocketClient } from './api/websocket'
import { LiveKitClient } from './api/livekit'
import type { ConsentData } from './ui/gdpr-consent'
import { logger } from './utils/logger'
import { initSentry, setSentryContext } from './utils/sentry'
import type { WidgetConfig, Agent, Conversation, Message } from './types'

export class SynteraWidget {
  private config: WidgetConfig
  private chatInterface: ChatInterface | null = null
  private apiClient: APIClient
  private wsClient: WebSocketClient | null = null
  private liveKitClient: LiveKitClient | null = null
  private agent: Agent | null = null
  private conversation: Conversation | null = null
  private isInitialized = false
  private consentData: ConsentData | null = null
  private isClosing = false // Prevent infinite recursion in close handlers

  constructor(config: WidgetConfig) {
    this.config = config
    this.apiClient = new APIClient(config.apiUrl, config.apiKey)
    
    // Initialize Sentry if DSN is provided
    if (config.sentryDsn) {
      initSentry({
        dsn: config.sentryDsn,
        environment: 'production',
        agentId: config.agentId,
        apiUrl: config.apiUrl,
      })
    }
  }

  /**
   * Initialize the widget
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Widget already initialized')
      return
    }

    try {
      // Load agent configuration
      this.agent = await this.apiClient.getAgent(this.config.agentId)
      
      if (!this.agent) {
        const error = new Error('Agent not found')
        // Set context before throwing
        setSentryContext({
          tags: { errorType: 'agent_not_found' },
          extra: { agentId: this.config.agentId },
        })
        throw error
      }

      // Skip GDPR consent check - directly initialize chat interface
      // Set default consent data for necessary permissions only
      this.consentData = {
        necessary: true,
        analytics: false,
        marketing: false,
        dataProcessing: true,
        timestamp: new Date().toISOString()
      }

      // Initialize chat interface directly
      this.initializeChatInterface()

      this.isInitialized = true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to initialize widget:', {
        error: errorMessage,
        agentId: this.config.agentId,
        apiUrl: this.config.apiUrl,
        stack: error instanceof Error ? error.stack : undefined,
      })
      this.showError(`Failed to load chat: ${errorMessage}. Please check the console for details.`)
    }
  }

  /**

  /**
   * Initialize chat interface (after consent)
   */
  private initializeChatInterface(): void {
    if (!this.agent) return

      // Create chat interface
      this.chatInterface = new ChatInterface({
        agent: this.agent,
        theme: this.config.theme || 'light',
        position: this.config.position || 'bottom-right',
        onSendMessage: this.handleSendMessage.bind(this),
        onStartCall: this.handleStartCall.bind(this),
        onEndCall: this.handleEndCall.bind(this),
        onClose: this.handleClose.bind(this),
      })

      // Initialize chat interface
      this.chatInterface.init()
  }

  /**
   * Handle sending a message
   */
  private async handleSendMessage(content: string, tempMessageId?: string): Promise<void> {
    if (!this.chatInterface || !this.agent) return

    // Consent check skipped - using default consent data

    try {
      // Create conversation if needed
      if (!this.conversation) {
        this.conversation = await this.apiClient.createConversation({
          agentId: this.config.agentId,
          channel: 'chat',
          metadata: {
            gdpr_consent: this.consentData,
          },
        })
      }

      // Send message
      const message = await this.apiClient.sendMessage({
        conversationId: this.conversation.id,
        content,
        threadId: null, // Main conversation thread
      })

      // Replace temp message with real message (or add if no temp message)
      this.chatInterface.addMessage(message, tempMessageId)

      // Connect WebSocket if not connected
      if (!this.wsClient && this.conversation) {
        await this.connectWebSocket()
      }

      // Wait for agent response (handled via WebSocket)
    } catch (error) {
      logger.error('Failed to send message:', error)
      this.chatInterface.showError('Failed to send message. Please try again.')
      // Remove temp message on error
      if (tempMessageId && this.chatInterface) {
        const tempEl = document.querySelector(`[data-message-id="${tempMessageId}"]`)
        tempEl?.remove()
      }
    }
  }

  /**
   * Handle starting a voice/video call
   */
  private async handleStartCall(type: 'voice' | 'video'): Promise<void> {
    if (!this.chatInterface || !this.agent) return

    // Consent check skipped - using default consent data

    try {
      // Create conversation if needed
      if (!this.conversation) {
        this.conversation = await this.apiClient.createConversation({
          agentId: this.config.agentId,
          channel: type,
          metadata: {
            gdpr_consent: this.consentData,
          },
        })
      }

      // Get LiveKit token
      const tokenData = await this.apiClient.getLiveKitToken({
        conversationId: this.conversation.id,
        agentId: this.config.agentId,
      })

      // Create LiveKit client
      this.liveKitClient = new LiveKitClient()

      // Set up callbacks
      const callbacks = {
        onParticipantConnected: (participant: any) => {
          // Agent connected
        },
        onTrackSubscribed: async (track: any, participant: any) => {
          // Check if this is the agent's audio track
          // Try multiple identity patterns
          const isAgent = participant.identity?.startsWith('agent:') || 
                         participant.identity?.includes('agent') ||
                         participant.identity?.toLowerCase().includes('agent')
          
          if (track.kind === 'audio' && isAgent) {
            // Set up audio analyser for voice circle animation
            if (this.chatInterface && track.mediaStreamTrack) {
              this.chatInterface.setupAudioAnalyser(track.mediaStreamTrack)
            }
          }
        },
        onDisconnected: async () => {
          // Stop audio monitoring
          if (this.chatInterface) {
            this.chatInterface.stopAudioMonitoring()
            this.chatInterface.endCall()
          }
          
          // Update conversation status when disconnected
          if (this.conversation) {
            try {
              await this.apiClient.updateConversation(this.conversation.id, {
                status: 'ended',
                ended_at: new Date().toISOString(),
              })
            } catch (error) {
              logger.error('Failed to update conversation status on disconnect:', error)
            }
          }
          
          this.liveKitClient = null
        },
        onError: (error: Error) => {
          logger.error('Call error:', error)
          this.chatInterface?.showError('Call error. Please try again.')
        },
      }

      // Connect to LiveKit room
      await this.liveKitClient.connect(tokenData.url, tokenData.token, callbacks)

      // Dispatch agent to the room (this sets room metadata and triggers agent connection)
      try {
        await this.apiClient.dispatchAgent({
          conversationId: this.conversation.id,
          agentId: this.config.agentId,
        })
      } catch (error) {
        logger.error('Failed to dispatch agent:', error)
        // Non-blocking: agent connection may still succeed via alternative path
      }

      // Start call UI
      await this.chatInterface.startCall({
        type,
        token: tokenData.token,
        url: tokenData.url,
        conversationId: this.conversation.id,
        agentId: this.config.agentId,
        apiUrl: this.config.apiUrl,
        apiKey: this.config.apiKey,
      })
    } catch (error) {
      logger.error('Failed to start call:', error)
      this.chatInterface.showError('Failed to start call. Please try again.')
      if (this.liveKitClient) {
        await this.liveKitClient.disconnect()
        this.liveKitClient = null
      }
    }
  }

  /**
   * Handle ending a call
   */
  private async handleEndCall(): Promise<void> {
    try {
      // Disconnect from LiveKit
      if (this.liveKitClient) {
        await this.liveKitClient.disconnect()
        this.liveKitClient = null
      }

      // Update conversation status to 'ended'
      if (this.conversation) {
        try {
          await this.apiClient.updateConversation(this.conversation.id, {
            status: 'ended',
            ended_at: new Date().toISOString(),
          })
        } catch (error) {
          logger.error('Failed to update conversation status:', error)
        }
      }

      // Update UI
      if (this.chatInterface) {
        this.chatInterface.endCall()
      }
    } catch (error) {
      logger.error('Failed to end call:', error)
      this.chatInterface?.showError('Failed to end call. Please try again.')
    }
  }

  /**
   * Connect WebSocket for real-time messages
   */
  private async connectWebSocket(): Promise<void> {
    if (!this.conversation) return

    try {
      // Get WebSocket token/URL from API
      const wsConfig = await this.apiClient.getWebSocketConfig(this.conversation.id)

      this.wsClient = new WebSocketClient({
        url: wsConfig.url,
        token: wsConfig.token,
        conversationId: this.conversation.id,
        onMessage: (message: Message) => {
          // Only add agent messages from WebSocket (user messages already added from API response)
          // This prevents duplicate user messages
          if (this.chatInterface && message.role === 'agent') {
            this.chatInterface.addMessage(message)
          }
        },
        onTyping: (isTyping: boolean) => {
          if (this.chatInterface) {
            this.chatInterface.setTyping(isTyping)
          }
        },
        onError: (error: Error) => {
          // Only log persistent errors, not transient connection issues
          if (!error.message.includes('websocket error') && !error.message.includes('transport')) {
            logger.error('WebSocket error:', error)
          }
        },
      })

      await this.wsClient.connect()
    } catch (error) {
      logger.error('Failed to connect WebSocket:', error)
    }
  }

  /**
   * Handle closing the widget
   */
  private handleClose(): void {
    // Prevent infinite recursion
    if (this.isClosing) {
      return
    }
    this.isClosing = true

    try {
      // Disconnect LiveKit client first
      if (this.liveKitClient) {
        this.liveKitClient.disconnect().catch((error) => {
          logger.error('Error disconnecting LiveKit client:', error)
        })
        this.liveKitClient = null
      }

      // Disconnect WebSocket
      if (this.wsClient) {
        this.wsClient.disconnect()
        this.wsClient = null
      }

      // Close chat interface (this will trigger onClose callback, but we're protected by isClosing flag)
      if (this.chatInterface) {
        this.chatInterface.close()
      }
    } finally {
      // Reset flag after a short delay to allow cleanup
      setTimeout(() => {
        this.isClosing = false
      }, 100)
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    // Create error notification display
    const errorDiv = document.createElement('div')
    errorDiv.className = 'syntera-error'
    errorDiv.textContent = message
    errorDiv.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `
    document.body.appendChild(errorDiv)

    // Auto-dismiss error message after 5 seconds
    setTimeout(() => {
      errorDiv.remove()
    }, 5000)
  }

  /**
   * Public API: Open widget programmatically
   */
  open(): void {
    if (this.chatInterface) {
      this.chatInterface.open()
    }
  }

  /**
   * Public API: Close widget programmatically
   */
  close(): void {
    this.handleClose()
  }

  /**
   * Public API: Send message programmatically
   */
  async sendMessage(content: string): Promise<void> {
    await this.handleSendMessage(content)
  }
}

