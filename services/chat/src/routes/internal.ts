/**
 * Internal API Routes for Service-to-Service Communication
 * These endpoints are used by other services (Agent Service, etc.)
 */

import express from 'express'
import { Server } from 'socket.io'
import { z } from 'zod'
import { createLogger } from '@syntera/shared/logger/index.js'
import { Message } from '@syntera/shared/models'

const logger = createLogger('chat-service:internal')
const router = express.Router()

function validateInternalToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN
  
  if (!expectedToken) {
    logger.error('INTERNAL_SERVICE_TOKEN not configured')
    return res.status(500).json({ error: 'Service configuration error' })
  }
  
  if (token !== expectedToken) {
    logger.warn('Invalid internal service token', { provided: token?.substring(0, 10) + '...' })
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  next()
}

const EmitMessageSchema = z.object({
  conversationId: z.string().min(1),
  message: z.object({
    id: z.string().optional(), // Widget expects 'id'
    _id: z.string(), // Keep _id for compatibility
    conversation_id: z.string(),
    thread_id: z.string().nullable().optional(),
    sender_type: z.enum(['user', 'agent', 'system']),
    role: z.enum(['user', 'agent', 'assistant', 'system']), // Accept both 'agent' and 'assistant' for compatibility
    content: z.string(),
    message_type: z.string(),
    ai_metadata: z.record(z.string(), z.any()).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    created_at: z.string(),
  }),
})

const CreateMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1),
  senderType: z.enum(['user', 'agent', 'system']),
  messageType: z.enum(['text', 'audio', 'video', 'file', 'image', 'system']).default('audio'),
  threadId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

/**
 * POST /api/internal/messages/emit
 * Emit a message via Socket.io to connected clients
 * Used by Agent Service to send agent responses to widgets
 */
router.post(
  '/messages/emit',
  validateInternalToken,
  (req: express.Request, res: express.Response) => {
    try {
      const validationResult = EmitMessageSchema.safeParse(req.body)
      if (!validationResult.success) {
        logger.warn('Validation failed for emit message', { 
          issues: validationResult.error.issues,
        })
        return res.status(400).json({ 
          error: 'Validation failed',
          details: validationResult.error.issues 
        })
      }

      const { conversationId, message } = validationResult.data

      // Get Socket.io instance from app
      const io: Server | undefined = req.app.get('io')
      
      if (!io) {
        logger.error('Socket.io instance not found in app', { 
          availableKeys: Object.keys(req.app.locals || {}),
        })
        return res.status(500).json({ error: 'Socket.io not initialized' })
      }

      // Ensure message has 'id' field for widget compatibility (use id if provided, otherwise _id)
      const messageToEmit = {
        ...message,
        id: message.id || message._id,
      }

      // Emit message to all clients in the conversation room
      io.to(`conversation:${conversationId}`).emit('message', messageToEmit)

      logger.info('Message emitted via internal API', {
        conversationId,
        messageId: message._id,
        senderType: message.sender_type,
      })

      res.json({ success: true, messageId: message._id })
    } catch (error) {
      logger.error('Failed to emit message', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        conversationId: req.body?.conversationId,
      })
      res.status(500).json({ error: 'Failed to emit message' })
    }
  }
)

/**
 * POST /api/internal/messages/create
 * Create a message in MongoDB
 * Used by Voice Agent to save voice call transcripts
 */
router.post(
  '/messages/create',
  validateInternalToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const validationResult = CreateMessageSchema.safeParse(req.body)
      if (!validationResult.success) {
        logger.warn('Validation failed for create message', { 
          issues: validationResult.error.issues,
        })
        return res.status(400).json({ 
          error: 'Validation failed',
          details: validationResult.error.issues 
        })
      }

      const { conversationId, content, senderType, messageType, threadId, metadata } = validationResult.data

      // Map senderType to role
      const role = senderType === 'agent' ? 'assistant' : senderType

      // Create message in MongoDB
      const message = await Message.create({
        conversation_id: conversationId,
        thread_id: threadId || undefined,
        sender_type: senderType,
        role: role,
        content: content,
        message_type: messageType,
        metadata: metadata || {},
      })

      logger.info('Message created via internal API', {
        conversationId,
        messageId: String(message._id),
        senderType,
        messageType,
      })

      // Get Socket.io instance and emit message to connected clients
      const io: Server | undefined = req.app.get('io')
      if (io) {
        const messageToEmit = {
          _id: String(message._id),
          id: String(message._id),
          conversation_id: conversationId,
          thread_id: threadId || null,
          sender_type: senderType,
          role: role,
          content: content,
          message_type: messageType,
          metadata: message.metadata || {},
          created_at: message.created_at.toISOString(),
        }
        io.to(`conversation:${conversationId}`).emit('message', messageToEmit)
      }

      res.json({ 
        success: true, 
        message: {
          _id: String(message._id),
          conversation_id: conversationId,
          sender_type: senderType,
          role: role,
          content: content,
          message_type: messageType,
          created_at: message.created_at.toISOString(),
        }
      })
    } catch (error) {
      logger.error('Failed to create message', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        conversationId: req.body?.conversationId,
      })
      res.status(500).json({ error: 'Failed to create message' })
    }
  }
)

/**
 * POST /api/internal/messages/list
 * 
 * Retrieves messages for analytics purposes (internal service use only).
 * Filters messages by company_id through conversation relationships.
 * 
 * This endpoint is used by the analytics API to aggregate message data
 * for performance metrics and reporting.
 * 
 * @requires INTERNAL_SERVICE_TOKEN authentication
 */
router.post(
  '/messages/list',
  validateInternalToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const { companyId, limit = 1000, startDate, endDate } = req.body

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' })
      }

      // Dynamically import Conversation model to avoid circular dependencies
      const { Conversation } = await import('@syntera/shared/models')

      // Build query to find conversations for the specified company
      const conversationQuery: Record<string, unknown> = {
        company_id: companyId,
      }

      // Apply date range filter if provided
      if (startDate || endDate) {
        conversationQuery.started_at = {}
        if (startDate) {
          conversationQuery.started_at.$gte = new Date(startDate)
        }
        if (endDate) {
          conversationQuery.started_at.$lte = new Date(endDate)
        }
      }

      // Retrieve conversation IDs for the company
      const conversations = await Conversation.find(conversationQuery)
        .select('_id')
        .lean()

      const conversationIds = conversations.map((c) => String(c._id))

      // Return empty result if no conversations found
      if (conversationIds.length === 0) {
        return res.json({ messages: [], total: 0 })
      }

      // Query messages associated with the retrieved conversations
      const messageQuery: Record<string, unknown> = {
        conversation_id: { $in: conversationIds },
      }

      const messages = await Message.find(messageQuery)
        .select('_id conversation_id sender_type role content message_type ai_metadata metadata created_at')
        .sort({ created_at: -1 })
        .limit(Number(limit))
        .lean()

      // Transform Mongoose documents to plain objects for JSON serialization
      const messagesData = messages.map((m) => ({
        _id: String(m._id),
        conversation_id: m.conversation_id,
        sender_type: m.sender_type,
        role: m.role,
        content: m.content,
        message_type: m.message_type,
        ai_metadata: m.ai_metadata || {},
        metadata: m.metadata || {},
        created_at: m.created_at instanceof Date ? m.created_at.toISOString() : m.created_at,
      }))

      res.json({
        messages: messagesData,
        total: messagesData.length,
      })
    } catch (error) {
      logger.error('Failed to retrieve messages for analytics', {
        error: error instanceof Error ? error.message : String(error),
        companyId: req.body?.companyId,
        stack: error instanceof Error ? error.stack : undefined,
      })
      res.status(500).json({ error: 'Failed to list messages' })
    }
  }
)

/**
 * PATCH /api/internal/conversations/:id/update
 * Update conversation status (used by voice agent when session ends)
 */
router.patch(
  '/conversations/:id/update',
  validateInternalToken,
  async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params
      const { status, ended_at } = req.body

      if (!id) {
        return res.status(400).json({ error: 'Conversation ID is required' })
      }

      // Import Conversation model
      const { Conversation } = await import('@syntera/shared/models')

      // Update conversation
      const updateData: any = {}
      if (status) {
        updateData.status = status
      }
      if (ended_at) {
        updateData.ended_at = new Date(ended_at)
      }
      updateData.updated_at = new Date()

      await Conversation.findByIdAndUpdate(id, updateData)

      logger.info('Conversation status updated via internal API', {
        conversationId: id,
        updates: Object.keys(updateData),
      })

      res.json({ success: true })
    } catch (error) {
      logger.error('Failed to update conversation status', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        conversationId: req.params?.id,
      })
      res.status(500).json({ error: 'Failed to update conversation status' })
    }
  }
)

export default router

