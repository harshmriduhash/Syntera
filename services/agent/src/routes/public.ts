/**
 * Public API Routes for Widget Integration
 * 
 * These endpoints provide external API access for the embeddable Syntera widget.
 * Authentication is performed via API key (pub_key_{agentId}) rather than user JWT tokens,
 * allowing the widget to be embedded on third-party websites without requiring
 * user authentication.
 * 
 * All routes include CORS headers to support cross-origin widget embedding.
 */

import express from 'express'
import { z } from 'zod'
import { authenticateApiKey, ApiKeyRequest } from '../middleware/api-key-auth.js'
import { supabase } from '../config/database.js'
import { generateAccessToken, getRoomName, getLiveKitUrl, getUserPermissions, getAgentPermissions } from '../services/livekit.js'
import { handleError, badRequest } from '../utils/errors.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { Conversation, Message } from '@syntera/shared/models/index.js'
import { generateResponse } from '../services/openai.js'
import { extractContactInfoLLM } from '../utils/contact-extractor-llm.js'
import { findOrCreateContact, updateContact } from '../utils/contacts.js'
import { fetchWithTimeout } from '../utils/fetch-with-timeout.js'
import { getAgentConfig } from '../utils/agent-cache.js'
import type { AgentConfig } from '../types/agent.js'
import { searchKnowledgeBase } from '../utils/knowledge-base.js'
import { getConversationHistory, invalidateConversationHistory } from '../utils/conversation-cache.js'
import { RoomServiceClient } from 'livekit-server-sdk'

const logger = createLogger('agent-service:public-api')
const router = express.Router()

/**
 * CORS Middleware for Public Routes
 * 
 * Enables cross-origin requests to support widget embedding on external websites.
 * Handles preflight OPTIONS requests and sets appropriate CORS headers.
 */
router.use((req, res, next) => {
  // Use request origin when available, otherwise allow all origins
  // This supports both same-origin and cross-origin widget embedding
  const origin = req.headers.origin
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin)
  } else {
    // Fallback for requests without origin header (e.g., file:// protocol)
    res.header('Access-Control-Allow-Origin', '*')
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Credentials', 'true')
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

/**
 * GET /api/public/test
 * 
 * Health check endpoint to verify Supabase database connectivity.
 * Returns sample agent data to confirm database access is functioning.
 * 
 * @route GET /api/public/test
 */
router.get('/test', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agent_configs')
      .select('id, name, company_id')
      .limit(1)
    
    if (error) {
      return res.status(500).json({ 
        error: 'Supabase query failed',
        message: error.message,
        code: error.code,
        details: error
      })
    }
    
    res.json({ 
      success: true,
      message: 'Supabase connection working',
      agentCount: data?.length || 0,
      sampleAgent: data?.[0] || null
    })
  } catch (error) {
    res.status(500).json({ 
      error: 'Test failed',
      message: error instanceof Error ? error.message : String(error)
    })
  }
})

// Request schemas
const GetAgentSchema = z.object({
  agentId: z.string().uuid(),
})

const CreateConversationSchema = z.object({
  agentId: z.string().uuid(),
  channel: z.enum(['chat', 'voice', 'video']).default('chat'),
  contactId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const SendMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(10000),
  threadId: z.string().optional().nullable(),
})

const LiveKitTokenSchema = z.object({
  conversationId: z.string().min(1),
  agentId: z.string().uuid(),
})

const WebSocketConfigSchema = z.object({
  conversationId: z.string().min(1),
})

/**
 * GET /api/public/agents/:agentId
 * 
 * Retrieves public agent configuration for widget display.
 * Returns only non-sensitive information (name, model, avatar, etc.).
 * 
 * @route GET /api/public/agents/:agentId
 * @requires API key authentication
 */
router.get(
  '/agents/:agentId',
  authenticateApiKey,
  async (req: ApiKeyRequest, res) => {
    try {
      const { agentId } = req.params

      if (agentId !== req.agentId) {
        return res.status(403).json({ error: 'Agent ID mismatch' })
      }

      // CRITICAL: Always filter by company_id for data isolation
      if (!req.companyId) {
        logger.error('Company ID missing in API key authentication', { agentId })
        return res.status(403).json({ error: 'Access denied' })
      }

      const { data: agent, error } = await supabase
        .from('agent_configs')
        .select('id, name, model, system_prompt, temperature, avatar_url, company_id')
        .eq('id', agentId)
        .eq('company_id', req.companyId) // CRITICAL: Filter by company_id
        .single()

      if (error || !agent) {
        logger.warn('Agent configuration not found or access denied', {
          agentId,
          companyId: req.companyId,
          error: error?.message,
        })
        return res.status(404).json({ error: 'Agent not found' })
      }

      // Double-check company_id matches (defense in depth)
      if (agent.company_id !== req.companyId) {
        logger.error('Agent company_id mismatch in public API', {
          agentId,
          expectedCompanyId: req.companyId,
          actualCompanyId: agent.company_id,
        })
        return res.status(403).json({ error: 'Access denied' })
      }

      res.json({
        id: agent.id,
        name: agent.name,
        model: agent.model,
        avatar_url: agent.avatar_url || null,
      })
    } catch (error) {
      logger.error('Failed to retrieve agent configuration', {
        error: error instanceof Error ? error.message : String(error),
        agentId: req.params.agentId,
      })
      handleError(error, res)
    }
  }
)

/**
 * POST /api/public/conversations
 * Create a new conversation (anonymous user)
 */
router.post(
  '/conversations',
  authenticateApiKey,
  async (req: ApiKeyRequest, res) => {
    try {
      const validationResult = CreateConversationSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(res, validationResult.error.issues[0].message)
      }

      const { agentId, channel, contactId } = validationResult.data

      if (agentId !== req.agentId) {
        return res.status(403).json({ error: 'Agent ID mismatch' })
      }

      // Verify agent exists (already verified in middleware, but double-check)
      const { data: agent, error: agentError } = await supabase
        .from('agent_configs')
        .select('id, company_id')
        .eq('id', agentId)
        .eq('company_id', req.companyId!)
        .single()

      if (agentError || !agent) {
        return res.status(404).json({ error: 'Agent not found' })
      }

      // Find or create contact if email/phone provided in metadata
      let finalContactId = contactId
      const metadata = (req.body.metadata as Record<string, unknown> | undefined) || {}
      const email = metadata.email as string | undefined
      const phone = metadata.phone as string | undefined

      if (!finalContactId && (email || phone)) {
        const contactResult = await findOrCreateContact({
          companyId: req.companyId!,
          email,
          phone,
          metadata,
              })
        finalContactId = contactResult.contactId || undefined
      }

      // Create conversation in MongoDB with contact_id at top level
      const conversation = await Conversation.create({
        agent_id: agentId,
        company_id: req.companyId!,
        contact_id: finalContactId || undefined,
        channel,
        status: 'active',
        metadata: {
          source: 'widget',
          ...metadata,
        },
      })


      res.json({
        conversation: {
          id: String(conversation._id),
          agent_id: conversation.agent_id,
          channel: conversation.channel,
          status: conversation.status,
          started_at: conversation.started_at.toISOString(),
        },
      })
    } catch (error) {
      logger.error('Failed to create new conversation', {
        error: error instanceof Error ? error.message : String(error),
        agentId: req.body?.agentId,
        companyId: req.companyId,
      })
      handleError(error, res)
    }
  }
)

/**
 * PATCH /api/public/conversations/:id
 * 
 * Updates conversation metadata such as status and end timestamp.
 * Used by the widget to mark conversations as ended when users close the chat.
 * 
 * @route PATCH /api/public/conversations/:id
 * @requires API key authentication
 */
router.patch(
  '/conversations/:id',
  authenticateApiKey,
  async (req: ApiKeyRequest, res) => {
    try {
      const { id } = req.params
      const { status, ended_at } = req.body

      if (!id) {
        return res.status(400).json({ error: 'Conversation ID is required' })
      }

      // Verify conversation exists and belongs to the authenticated company
      let conversation
      try {
        conversation = await Conversation.findOne({
          _id: id,
          company_id: req.companyId!,
        })
      } catch (dbError) {
        logger.error('Database error while retrieving conversation for update', {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          conversationId: id,
          companyId: req.companyId,
        })
        return res.status(500).json({ error: 'Database error finding conversation' })
      }

      if (!conversation) {
        logger.warn('Conversation not found or access denied', {
          conversationId: id,
          companyId: req.companyId,
        })
        return res.status(404).json({ error: 'Conversation not found' })
      }

      // Update conversation
      const updateData: any = {}
      if (status) {
        updateData.status = status
      }
      if (ended_at) {
        updateData.ended_at = new Date(ended_at)
      }
      updateData.updated_at = new Date()

      try {
        await Conversation.findByIdAndUpdate(id, updateData)
      } catch (updateError) {
        logger.error('Database error updating conversation', {
          error: updateError instanceof Error ? updateError.message : String(updateError),
          conversationId: id,
        })
        return res.status(500).json({ error: 'Failed to update conversation' })
      }

      logger.info('Conversation updated via public API', {
        conversationId: id,
        updates: Object.keys(updateData),
      })

      res.json({ success: true })
    } catch (error) {
      logger.error('Failed to update conversation', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        conversationId: req.params?.id,
      })
      handleError(error, res)
    }
  }
)

/**
 * POST /api/public/messages
 * Send a message (creates message and triggers agent response)
 */
router.post(
  '/messages',
  authenticateApiKey,
  async (req: ApiKeyRequest, res) => {
    try {
      const validationResult = SendMessageSchema.safeParse(req.body)
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Validation failed',
          details: validationResult.error.issues 
        })
      }

      const { conversationId, content, threadId } = validationResult.data

      // Retrieve conversation to verify existence and ownership
      // Some routes don't include agentId in middleware, so verification occurs here
      const conversation = await Conversation.findOne({
        _id: conversationId,
      })

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      // Set company and agent context from conversation if not already set by middleware
      if (!req.companyId) {
        req.companyId = conversation.company_id
        req.agentId = conversation.agent_id
      } else {
        // Verify conversation ownership matches authenticated company
        if (conversation.company_id !== req.companyId) {
          return res.status(403).json({ error: 'Conversation does not belong to company' })
        }
        
        // Verify agent assignment matches API key's agent
        if (conversation.agent_id !== req.agentId) {
          return res.status(403).json({ error: 'Agent mismatch' })
        }
      }

      // Persist user message to database
      const message = await Message.create({
        conversation_id: conversationId,
        thread_id: threadId || null,
        sender_type: 'user',
        role: 'user',
        content,
        message_type: 'text',
      })

      // Invalidate conversation history cache to ensure fresh data on next retrieval
      invalidateConversationHistory(conversationId, threadId || null).catch((error) => {
        logger.warn('Failed to invalidate conversation history cache', {
          error: error instanceof Error ? error.message : String(error),
          conversationId,
          threadId: threadId || null,
        })
      })

      // Extract contact information from message asynchronously (non-blocking)
      processContactInfoFromMessage(
        conversation,
        content,
        req.companyId!
      ).catch((error) => {
        logger.error('Failed to extract and process contact information from message', {
          error: error instanceof Error ? error.message : String(error),
          conversationId,
        })
      })

      // Generate agent response asynchronously (non-blocking)
      generateAgentResponseForWidget(
        conversationId,
        content,
        conversation.agent_id,
        req.companyId!,
        threadId || null
      ).catch((error) => {
        logger.error('Failed to generate agent response for user message', {
          error: error instanceof Error ? error.message : String(error),
          conversationId,
          agentId: conversation.agent_id,
        })
      })

      res.json({
        message: {
          id: String(message._id),
          conversation_id: conversationId,
          thread_id: threadId || null,
          role: 'user',
          content,
          created_at: message.created_at.toISOString(),
        },
      })
    } catch (error) {
      logger.error('Failed to process and send user message', {
        error: error instanceof Error ? error.message : String(error),
        conversationId: req.body?.conversationId,
      })
      handleError(error, res)
    }
  }
)

/**
 * POST /api/public/livekit/token
 * Generate LiveKit token for voice/video calls
 */
router.post(
  '/livekit/token',
  authenticateApiKey,
  async (req: ApiKeyRequest, res) => {
    try {
      const validationResult = LiveKitTokenSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(res, validationResult.error.issues[0].message)
      }

      const { conversationId, agentId } = validationResult.data

      if (agentId !== req.agentId) {
        return res.status(403).json({ error: 'Agent ID mismatch' })
      }

      // Verify conversation exists
      const conversation = await Conversation.findOne({
        _id: conversationId,
        company_id: req.companyId!,
      })

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      const roomName = getRoomName(conversationId)
      const identity = `widget-user:${conversationId}` // Anonymous user identity
      const permissions = getUserPermissions()

      // Create room with metadata BEFORE generating token
      // This ensures metadata is available when the agent auto-connects
      const roomMetadata = JSON.stringify({
        agentId,
        conversationId,
        companyId: req.companyId!,
        userId: 'widget-user',
        source: 'widget',
      })

      // Initialize LiveKit Room Service client
      const liveKitUrl = getLiveKitUrl()
      const httpUrl = liveKitUrl.replace('wss://', 'https://').replace('ws://', 'http://')
      const roomService = new RoomServiceClient(
        httpUrl,
        process.env.LIVEKIT_API_KEY!,
        process.env.LIVEKIT_API_SECRET!
      )

      try {
        // Try to create room with metadata first
        await roomService.createRoom({
          name: roomName,
          metadata: roomMetadata,
          emptyTimeout: 300,
          maxParticipants: 10,
        })
      } catch (error: any) {
        if (error.message?.includes('already exists') || error.message?.includes('exists')) {
          try {
            await roomService.updateRoomMetadata(roomName, roomMetadata)
          } catch (updateError) {
            logger.warn('Failed to update LiveKit room metadata after creation', {
              roomName,
              agentId,
              conversationId,
              error: updateError instanceof Error ? updateError.message : String(updateError),
            })
          }
        } else {
          logger.warn('Failed to create or update LiveKit room metadata', {
            roomName,
            agentId,
            conversationId,
            error: error instanceof Error ? error.message : String(error),
          })
          // Continue execution: room functionality is not dependent on metadata
        }
      }

      // NOW generate token (room exists with metadata)
      const token = await generateAccessToken({
        identity,
        roomName,
        permissions,
        metadata: JSON.stringify({
          agentId,
          conversationId,
          companyId: req.companyId!,
          source: 'widget',
        }),
      })

      logger.info('LiveKit access token generated successfully', {
        conversationId,
        agentId,
        roomName,
        identity,
      })

      res.json({
        token,
        url: getLiveKitUrl(),
        roomName,
        identity,
      })
    } catch (error) {
      logger.error('Failed to generate LiveKit access token', {
        error: error instanceof Error ? error.message : String(error),
        conversationId: req.body?.conversationId,
        agentId: req.body?.agentId,
      })
      handleError(error, res)
    }
  }
)

/**
 * POST /api/public/websocket/config
 * Get WebSocket configuration for chat service
 */
router.post(
  '/websocket/config',
  authenticateApiKey,
  async (req: ApiKeyRequest, res) => {
    try {
      const validationResult = WebSocketConfigSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(res, validationResult.error.issues[0].message)
      }

      const { conversationId } = validationResult.data

      // Verify conversation exists
      const conversation = await Conversation.findOne({
        _id: conversationId,
      })

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      // If companyId wasn't set by middleware (route without agentId), set it from conversation
      if (!req.companyId) {
        req.companyId = conversation.company_id
        req.agentId = conversation.agent_id
      } else {
        // Verify conversation belongs to company
        if (conversation.company_id !== req.companyId) {
          return res.status(403).json({ error: 'Conversation does not belong to company' })
        }
      }

      // Generate WebSocket configuration for widget chat connection
      // Uses token-based authentication compatible with the chat service
      const chatServiceUrl = process.env.CHAT_SERVICE_URL
      if (!chatServiceUrl) {
        throw new Error('CHAT_SERVICE_URL environment variable is required')
      }
      
      // Generate WebSocket authentication token
      // Uses base64-encoded JSON token. Consider migrating to JWT with expiration
      // and signature verification for enhanced security in production.
      const token = Buffer.from(JSON.stringify({
        conversationId,
        agentId: req.agentId,
        companyId: req.companyId,
        apiKey: req.apiKey,
      })).toString('base64')

      res.json({
        url: chatServiceUrl.replace('http://', 'ws://').replace('https://', 'wss://'),
        token,
      })
    } catch (error) {
      logger.error('Failed to generate WebSocket configuration', {
        error: error instanceof Error ? error.message : String(error),
        conversationId: req.body?.conversationId,
      })
      handleError(error, res)
    }
  }
)

/**
 * Process Contact Information from User Message
 * 
 * Extracts contact information (email, phone, name, company) from user messages
 * using LLM-based extraction for improved accuracy and error detection.
 * 
 * Automatically creates or updates contact records in the CRM system when
 * contact information is detected in conversations.
 * 
 * @param conversation - Conversation document with metadata
 * @param messageContent - User message content to analyze
 * @param companyId - Company UUID for contact association
 */
async function processContactInfoFromMessage(
  conversation: { _id: { toString(): string } | string; metadata?: Record<string, unknown> | null; contact_id?: string },
  messageContent: string,
  companyId: string
): Promise<void> {
  try {
    // Retrieve recent conversation context to improve extraction accuracy
    // Uses a separate query (reverse chronological order) and doesn't use the
    // conversation history cache, which is optimized for chronological message
    // retrieval used in response generation
    const recentMessages = await Message.find({
      conversation_id: conversation._id,
    })
      .sort({ created_at: -1 })
      .limit(10)
      .lean()

    // Transform messages to LLM conversation format
    const conversationContext = recentMessages
      .reverse()
      .map((m) => ({
        role: (m.sender_type === 'agent' ? 'assistant' : m.role) as 'user' | 'assistant' | 'system',
        content: m.content,
      }))

    // Extract contact information using LLM-based extraction
    const extracted = await extractContactInfoLLM(messageContent, conversationContext)

    // Exit early if no contact information was extracted
    if (!extracted.email && !extracted.phone && !extracted.first_name && !extracted.last_name && !extracted.company_name) {
      return
    }

    // Log any data quality issues detected and corrected by the LLM
    if (extracted.errors_detected && extracted.errors_detected.length > 0) {
      logger.info('Contact information data quality issues detected and corrected', {
        errors: extracted.errors_detected,
        corrections: extracted.corrections_made,
        conversationId: String(conversation._id),
      })
    }


    // Get current conversation metadata and merge with extracted info
    const currentMetadata = conversation.metadata || {}
    const updatedMetadata = {
      ...currentMetadata,
      // Only add extracted fields if not already present
      ...(extracted.email && !currentMetadata.email ? { email: extracted.email } : {}),
      ...(extracted.phone && !currentMetadata.phone ? { phone: extracted.phone } : {}),
      ...(extracted.first_name && !currentMetadata.first_name ? { first_name: extracted.first_name } : {}),
      ...(extracted.last_name && !currentMetadata.last_name ? { last_name: extracted.last_name } : {}),
      ...(extracted.company_name && !currentMetadata.company_name ? { company_name: extracted.company_name } : {}),
    }

    // Update conversation metadata
    await Conversation.findByIdAndUpdate(conversation._id, {
      $set: { metadata: updatedMetadata },
    })

    // If we have email or phone, create/update contact
    const email = (updatedMetadata.email as string) || extracted.email
    const phone = (updatedMetadata.phone as string) || extracted.phone

    if (email || phone) {
      try {
        // Find or create contact using utility function (fixes N+1 query)
        const contactResult = await findOrCreateContact({
          companyId,
          email,
          phone,
          metadata: updatedMetadata,
        })

        if (contactResult.contactId) {
          // Update contact if we have new extracted info
          if (!contactResult.created && extracted) {
            const updates: Record<string, string> = {}
          if (extracted.first_name && !updatedMetadata.first_name) {
              updates.first_name = extracted.first_name
          }
          if (extracted.last_name && !updatedMetadata.last_name) {
              updates.last_name = extracted.last_name
          }
          if (extracted.company_name && !updatedMetadata.company_name) {
              updates.company_name = extracted.company_name
          }

            if (Object.keys(updates).length > 0) {
              await updateContact(contactResult.contactId, companyId, updates)
            }
        }

          // Link conversation to contact if not already linked
          if (!conversation.contact_id) {
          await Conversation.findByIdAndUpdate(conversation._id, {
              $set: { contact_id: contactResult.contactId },
          })

          logger.info('Linked conversation to contact', {
            conversationId: String(conversation._id),
              contactId: contactResult.contactId,
          })
          }
        }
      } catch (error) {
        logger.error('Error processing contact from message', {
          error,
          conversationId: String(conversation._id),
          email,
          phone,
        })
      }
    }
  } catch (error) {
    logger.error('Failed to process contact info from message', {
      error,
      conversationId: String(conversation._id),
    })
  }
}

/**
 * Generate Agent Response for Widget
 * 
 * Generates an AI agent response for widget conversations.
 * This is a simplified version that saves messages to the database
 * and emits them via Chat Service WebSocket, rather than using
 * direct Socket.io connections.
 * 
 * @param conversationId - MongoDB conversation ID
 * @param userMessage - User's message content
 * @param agentId - UUID of the agent to respond as
 * @param companyId - UUID of the company
 * @param threadId - Optional thread ID for threaded conversations
 */
async function generateAgentResponseForWidget(
  conversationId: string,
  userMessage: string,
  agentId: string,
  companyId: string,
  threadId: string | null
): Promise<void> {
  try {
    // Retrieve agent configuration (uses caching for performance)
    const agentData = await getAgentConfig(agentId, companyId)

    if (!agentData) {
      throw new Error('Agent not found')
    }

    const agent = agentData

    // Retrieve conversation history for context (uses caching)
    const conversationHistory = await getConversationHistory(conversationId, threadId, 20)

    // Search knowledge base in parallel with prompt preparation
    // Use timeout to prevent blocking if knowledge base service is slow
    const KB_SEARCH_TIMEOUT = 500 // 500ms timeout for knowledge base queries
    const knowledgeBasePromise = Promise.race([
      searchKnowledgeBase({
        query: userMessage,
        companyId,
        agentId: agent.id,
        topK: 5,
        maxResults: 5,
      }),
      new Promise<undefined>((resolve) => 
        setTimeout(() => resolve(undefined), KB_SEARCH_TIMEOUT)
      ),
    ]).catch((error) => {
      logger.warn('Knowledge base search failed or timed out', {
        error: error instanceof Error ? error.message : String(error),
        conversationId,
        agentId,
      })
      return undefined
    })

    // Enhance system prompt to naturally collect contact information
    let enhancedSystemPrompt = agent.system_prompt || 'You are a helpful AI assistant.'
    
    // Add instructions to naturally collect contact info when appropriate
    if (!enhancedSystemPrompt.toLowerCase().includes('contact') && !enhancedSystemPrompt.toLowerCase().includes('email') && !enhancedSystemPrompt.toLowerCase().includes('phone')) {
      enhancedSystemPrompt += `\n\nCONTACT INFORMATION COLLECTION - SMART TIMING:
Your PRIMARY goal is to answer the user's question completely and helpfully. AFTER providing a good answer, naturally ask for contact information when it makes sense.

WHEN TO ASK (prioritize answering first, then ask):
1. After fully answering a product/service question - Then offer: "I'd be happy to send you more detailed information. What's your email?"
2. After providing pricing information - Then offer: "I can send you a complete price list. What's your email address?"
3. When user shows clear interest (asks about specific products, wants to buy) - After helping, ask for follow-up
4. After 2-3 meaningful exchanges where you've provided value - Natural moment to ask

TIMING GUIDELINES:
- ALWAYS answer the question FIRST, completely and helpfully
- THEN, if appropriate, naturally transition to asking for contact info
- Spot the best moment - when the user seems engaged and you've provided value
- Don't ask too early (before establishing value) or too late (after they've lost interest)
- If the user's question requires immediate focus, answer fully first, then ask

GOOD EXAMPLES:
- User: "what are your products?" → You: [complete answer about products] → "I'd be happy to send you our full catalog. What's your email?"
- User: "what are the prices?" → You: [complete pricing information] → "I can send you a detailed price list with all options. What's your email?"
- User: "I'm interested in jeans" → You: [help with jeans] → "Great! I can send you more details about our jeans collection. What's your email?"

BAD EXAMPLES (don't do this):
- Asking before answering: "What's your email? [then provides info]"
- Asking when user just said "no" or seems uninterested
- Asking in the very first greeting

When user provides contact information, acknowledge it warmly and CONTINUE the conversation naturally. Do NOT reset to greeting.`
    }

    // Wait for knowledge base search (with timeout already handled)
    const knowledgeBaseContext = await knowledgeBasePromise

    // Generate response using OpenAI service
    // Knowledge base restriction instructions are added in generateResponse() function
    const response = await generateResponse({
      systemPrompt: enhancedSystemPrompt,
      userMessage,
      conversationHistory,
      knowledgeBaseContext,
      model: agent.model || 'gpt-4o-mini',
      temperature: agent.temperature || 0.7,
    })

    // Save agent response message
    const agentMessage = await Message.create({
      conversation_id: conversationId,
      thread_id: threadId || null,
      sender_type: 'agent',
      role: 'assistant',
      content: response.response,
      message_type: 'text',
      ai_metadata: {
        model: agent.model,
        tokens_used: response.tokensUsed,
      },
    })

    // Invalidate conversation history cache to ensure fresh data on next request
    invalidateConversationHistory(conversationId, threadId).catch((error) => {
      logger.warn('Failed to invalidate conversation history cache', {
        error: error instanceof Error ? error.message : String(error),
        conversationId,
        threadId: threadId || null,
      })
    })

    // Emit message to connected clients via Chat Service WebSocket
    try {
      const chatServiceUrl = process.env.CHAT_SERVICE_URL
      if (!chatServiceUrl) {
        throw new Error('CHAT_SERVICE_URL environment variable is required')
      }
      const internalToken = process.env.INTERNAL_SERVICE_TOKEN || 'internal-token'
      
      // Validate internal service token format
      // Detects common misconfigurations (e.g., Stripe API keys)
      if (internalToken.startsWith('sk_live_') || internalToken.startsWith('sk_test_')) {
        logger.error('INTERNAL_SERVICE_TOKEN misconfigured: appears to be a Stripe API key', {
          tokenPrefix: internalToken.substring(0, 10) + '...',
          conversationId,
        })
      }
      
      const emitResponse = await fetchWithTimeout(
        `${chatServiceUrl}/api/internal/messages/emit`,
        {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalToken}`,
        },
        body: JSON.stringify({
          conversationId,
          message: {
            _id: String(agentMessage._id), // Required by Chat Service message schema
            id: String(agentMessage._id), // Widget compatibility field
            conversation_id: conversationId,
            thread_id: threadId || null,
            sender_type: 'agent' as const,
            role: 'agent' as const, // Widget expects 'agent' role, not 'assistant'
            content: response.response,
            message_type: 'text',
            ai_metadata: {
              model: agent.model,
              tokens_used: response.tokensUsed,
            },
            created_at: agentMessage.created_at.toISOString(),
          },
        }),
        },
        10000 // 10 second timeout for WebSocket emission
      )
      
      if (!emitResponse.ok) {
        const errorText = await emitResponse.text()
        logger.warn('Chat Service returned error when emitting message via WebSocket', {
          status: emitResponse.status,
          statusText: emitResponse.statusText,
          error: errorText,
          conversationId,
        })
      }
    } catch (error) {
      logger.warn('Failed to emit agent response via Chat Service WebSocket', { 
        error: error instanceof Error ? error.message : String(error),
        conversationId,
      })
      // Continue execution: message is persisted, widget can retrieve via polling if needed
    }

    logger.info('Agent response generated for widget', {
      conversationId,
      responseLength: response.response.length,
    })
  } catch (error) {
    logger.error('Failed to generate agent response for widget', { error, conversationId })
    throw error
  }
}

/**
 * POST /api/public/voice-bot/deploy
 * 
 * Deploys an AI voice agent to a LiveKit room for real-time voice interaction.
 * This endpoint is used by the embeddable widget to initiate voice calls.
 * 
 * The deployment process:
 * 1. Validates agent and conversation ownership
 * 2. Generates LiveKit access tokens
 * 3. Dispatches the agent to the Python Voice Agent Service
 * 4. Returns room information for client connection
 * 
 * @requires API key authentication via authenticateApiKey middleware
 */
const DeployBotSchema = z.object({
  conversationId: z.string().min(1),
  agentId: z.string().uuid(),
})

router.post(
  '/voice-bot/deploy',
  authenticateApiKey,
  async (req: ApiKeyRequest, res) => {
    try {
      const validationResult = DeployBotSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(res, validationResult.error.issues[0].message)
      }

      const { conversationId, agentId } = validationResult.data

      // Verify agent ID matches the API key's associated agent
      if (agentId !== req.agentId) {
        return res.status(403).json({ error: 'Agent ID mismatch' })
      }

      // Verify conversation exists and is associated with the specified agent
      const conversation = await Conversation.findOne({
        _id: conversationId,
        agent_id: agentId,
      })

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      logger.info('Initiating voice bot deployment', {
        conversationId,
        agentId,
        companyId: req.companyId,
      })

      // Generate LiveKit access token for the agent participant
      const roomName = getRoomName(conversationId)
      const identity = `agent:${agentId}`

      const token = await generateAccessToken({
        identity,
        roomName,
        permissions: getAgentPermissions(),
        metadata: JSON.stringify({
          agentId,
          conversationId,
          userId: 'widget-user', // Widget users are anonymous (no user account)
        }),
      })

      // Retrieve Python Voice Agent Service URL from environment
      const pythonServiceUrl = process.env.PYTHON_AGENT_SERVICE_URL
      if (!pythonServiceUrl) {
        logger.error('Python Voice Agent Service URL not configured', {
          conversationId,
          agentId,
        })
        throw new Error('PYTHON_AGENT_SERVICE_URL environment variable is required')
      }
      
      // Perform health check before dispatching to ensure service availability
      try {
        const healthCheck = await fetchWithTimeout(
          `${pythonServiceUrl}/health`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          3000 // 3 second timeout for health check
        )
        if (!healthCheck.ok) {
          logger.warn('Python Voice Agent Service health check failed', {
            status: healthCheck.status,
            pythonServiceUrl,
            conversationId,
            agentId,
          })
        } else {
          logger.debug('Python Voice Agent Service health check successful', {
            pythonServiceUrl,
            conversationId,
            agentId,
          })
        }
      } catch (healthError) {
        logger.error('Python Voice Agent Service health check failed or unreachable', {
          error: healthError instanceof Error ? healthError.message : String(healthError),
          pythonServiceUrl,
          conversationId,
          agentId,
        })
        // Continue with dispatch attempt: health check failure may be transient
      }
      
      logger.info('Dispatching agent to Python Voice Agent Service', {
        conversationId,
        agentId,
        pythonServiceUrl,
      })

      // Dispatch agent to Python Voice Agent Service
      // The service will handle LiveKit room setup and agent connection asynchronously
      let dispatchResponse
      try {
        dispatchResponse = await fetchWithTimeout(
          `${pythonServiceUrl}/api/agents/dispatch`,
          {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId,
            agentId,
            userId: 'widget-user',
            roomName,
            token,
          }),
          },
          10000 // 10 second timeout (service should return immediately)
        )
      } catch (fetchError) {
        logger.error('Network error while dispatching agent to Python Voice Agent Service', {
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          pythonServiceUrl,
          conversationId,
          agentId,
        })
        throw new Error(`Failed to connect to voice agent service: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`)
      }

      if (!dispatchResponse.ok) {
        const errorText = await dispatchResponse.text()
        logger.error('Python Voice Agent Service returned error during dispatch', {
          status: dispatchResponse.status,
          statusText: dispatchResponse.statusText,
          error: errorText,
          pythonServiceUrl,
          conversationId,
          agentId,
        })
        throw new Error(`Failed to dispatch agent: ${errorText || dispatchResponse.statusText}`)
      }

      const result = (await dispatchResponse.json()) as {
        success: boolean
        agentJobId: string
        message: string
      }

      logger.info('Voice bot deployed successfully', {
        conversationId,
        agentId,
        roomName,
        agentJobId: result.agentJobId,
      })

      res.json({
        success: true,
        message: 'Voice bot deployed successfully',
        conversationId,
        agentId,
        roomName,
        agentJobId: result.agentJobId,
      })
    } catch (error) {
      logger.error('Failed to deploy voice bot', {
        error: error instanceof Error ? error.message : String(error),
        conversationId: req.body?.conversationId,
        agentId: req.body?.agentId,
      })
      handleError(error, res)
    }
  }
)

export default router

