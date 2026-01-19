/**
 * Chat Service
 * Port: 4004
 * Handles real-time chat via Socket.io and conversation storage in MongoDB
 */

import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { initializeDatabase } from './config/database.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { initSentry } from '@syntera/shared/logger/sentry.js'
import { handleError } from '@syntera/shared/utils/errors.js'
import { authenticateSocket, type AuthenticatedSocket } from './middleware/auth.js'
import { handleSendMessage, handleTyping } from './handlers/messages.js'
import { handleJoinConversation, handleLeaveConversation } from './handlers/conversations.js'
import { handleCreateThread, handleSwitchThread } from './handlers/threads.js'
import conversationsRouter from './routes/conversations.js'
import internalRouter from './routes/internal.js'

// Initialize Sentry BEFORE creating logger
if (process.env.SENTRY_DSN) {
  initSentry({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION,
  })
}

const logger = createLogger('chat-service')
const app = express()

// Trust proxy (required for Railway and other reverse proxies)
// Set to 1 for Railway's single reverse proxy (more secure than 'true')
app.set('trust proxy', 1)

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true)
      }
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || []
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true)
      } else {
        callback(null, true)
      }
    },
    credentials: true,
  },
})
const PORT = process.env.PORT || 4004

// Middleware
app.use(helmet())
app.use(compression())
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests', message: 'Please try again later' })
  },
  skip: (req) => req.path === '/health',
})
app.use('/api/', limiter)

// Health check 
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'chat-service', timestamp: new Date().toISOString() })
})

// Make Socket.io instance available to routes
app.set('io', io)

// REST API routes
app.use('/api/conversations', conversationsRouter)
app.use('/api/internal', internalRouter)

// Socket.io authentication middleware
io.use(authenticateSocket)

// Socket.io connection handling
io.on('connection', (socket: AuthenticatedSocket) => {

  // Conversation events
  socket.on('conversation:join', (conversationId: string) => {
    handleJoinConversation(io, socket, conversationId)
  })

  socket.on('conversation:leave', (conversationId: string) => {
    handleLeaveConversation(socket, conversationId)
  })

  // Message events
  socket.on('message:send', (data) => {
    handleSendMessage(io, socket, data)
  })

  socket.on('typing', (data) => {
    handleTyping(io, socket, data)
  })

  // Thread events
  socket.on('thread:create', (data) => {
    handleCreateThread(io, socket, data)
  })

  socket.on('thread:switch', (data) => {
    handleSwitchThread(io, socket, data)
  })

  socket.on('disconnect', () => {
    // Client disconnected
  })
})

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  handleError(err, res)
})

// Start server
async function start() {
  try {
    // Start server first
    httpServer.listen(PORT, () => {
      logger.info(`Chat Service running on port ${PORT}`)
    })
    
    // Initialize database connections (non-blocking)
    initializeDatabase().catch((error) => {
      logger.warn('Database initialization failed, but service is running', { error: error.message })
    })
  } catch (error) {
    logger.error('Failed to start service', { error })
    process.exit(1)
  }
}

start()

