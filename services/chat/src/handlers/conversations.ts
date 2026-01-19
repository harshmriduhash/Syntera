/**
 * Conversation Handlers
 * Handles conversation joining and leaving
 */

import { Server } from 'socket.io'
import { AuthenticatedSocket } from '../middleware/auth.js'
import { Conversation } from '@syntera/shared/models'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('chat-service:conversations')

/**
 * Handle joining an existing conversation
 */
export async function handleJoinConversation(
  io: Server,
  socket: AuthenticatedSocket,
  conversationId: string
) {
  try {
    if (!socket.userId || !socket.companyId) {
      socket.emit('error', { message: 'User not authenticated' })
      return
    }

    // Verify conversation exists and belongs to user's company
    const conversation = await Conversation.findOne({
      _id: conversationId,
      company_id: socket.companyId,
    })

    if (!conversation) {
      socket.emit('error', { message: 'Conversation not found' })
      return
    }

    // Join conversation room
    socket.join(`conversation:${conversationId}`)

    // Emit conversation joined
    socket.emit('conversation:joined', {
      id: String(conversation._id),
      agentId: conversation.agent_id,
      channel: conversation.channel,
      status: conversation.status,
      startedAt: conversation.started_at,
    })

  } catch (error) {
    logger.error('Error joining conversation', { error, socketId: socket.id })
    socket.emit('error', { message: 'Failed to join conversation' })
  }
}

/**
 * Handle leaving a conversation
 */
export function handleLeaveConversation(
  socket: AuthenticatedSocket,
  conversationId: string
) {
  try {
    socket.leave(`conversation:${conversationId}`)
  } catch (error) {
    logger.error('Error leaving conversation', { error, socketId: socket.id })
  }
}


