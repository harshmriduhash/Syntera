/**
 * Agent Service
 * Port: 4002
 * Handles AI agent orchestration, LiveKit integration, and OpenAI interactions
 * 
 * CI/CD: Automated deployment via GitHub Actions and Railway
 * Build: TypeScript compilation with post-build flatten script and import rewriting
 * 
 * Trigger CI: Test workflow execution
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { initializeDatabase } from './config/database.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { initSentry } from '@syntera/shared/logger/sentry.js'
import { initializeOpenAI } from './services/openai.js'
import { handleError } from './utils/errors.js'
import agentsRouter from './routes/agents.js'
import responsesRouter from './routes/responses.js'
import summarizeRouter from './routes/summarize.js'
import intentRouter from './routes/intent.js'
import sentimentRouter from './routes/sentiment.js'
import livekitRouter from './routes/livekit.js'
import voiceBotRouter from './routes/voice-bot.js'
import publicRouter from './routes/public.js'
import analysisRouter from './routes/analysis.js'
import workflowsRouter from './routes/workflows.js'
import internalRouter from './routes/internal.js'
import notificationsRouter from './routes/notifications.js'
import { startAnalysisProcessor } from './jobs/analysis-processor.js'
import { createServer } from 'http'

// Initialize Sentry BEFORE creating logger
if (process.env.SENTRY_DSN) {
  initSentry({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION,
  })
}

const logger = createLogger('agent-service')
const app = express()
const PORT = process.env.PORT || 4002
const server = createServer(app)

app.set('trust proxy', true)

app.use(helmet())
app.use(compression())
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:8000',
]
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or file:// protocol)
    if (!origin) {
      return callback(null, true)
    }
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true)
    } else {
      callback(null, true) // Allow all for development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '10mb' }))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown'
  },
})
app.use('/api/', limiter)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'agent-service', timestamp: new Date().toISOString() })
})

app.use('/api/agents', agentsRouter)
app.use('/api/responses', responsesRouter)
app.use('/api/responses', summarizeRouter)
app.use('/api/responses', intentRouter)
app.use('/api/responses', sentimentRouter)
app.use('/api/livekit', livekitRouter)
app.use('/api/voice-bot', voiceBotRouter)
app.use('/api/analysis', analysisRouter)
app.use('/api/public', publicRouter)
app.use('/api/workflows', workflowsRouter)
app.use('/api/internal', internalRouter)
app.use('/api/webhooks', internalRouter)
app.use('/api/notifications', notificationsRouter)

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  handleError(err, res)
})

async function start() {
  try {
    server.listen(PORT, () => {
      logger.info(`Agent Service running on port ${PORT}`)
    })
    
    Promise.all([
      initializeDatabase(),
      initializeOpenAI(),
    ])
      .then(() => {
        if (process.env.ENABLE_AUTO_ANALYSIS !== 'false') {
          startAnalysisProcessor()
        }
      })
      .catch((error) => {
        logger.warn('Initialization failed, but service is running', { error: error.message })
      })
  } catch (error) {
    logger.error('Failed to start service', { error })
    process.exit(1)
  }
}

start()

