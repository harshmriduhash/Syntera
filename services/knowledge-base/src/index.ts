/**
 * Knowledge Base Service
 * Port: 4005
 * Handles document processing, text extraction, chunking, and vector embeddings
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { createLogger } from '@syntera/shared/logger/index.js'
import { initSentry } from '@syntera/shared/logger/sentry.js'
import { handleError } from '@syntera/shared/utils/errors.js'
import { initializeDatabase } from './config/database.js'
import { initializeProcessor } from './services/processor.js'
import { enqueueDocument, closeQueue, getDocumentWorker } from './services/queue.js'
import { getSupabase } from './config/database.js'
import documentRoutes from './routes/documents.js'

// Initialize Sentry BEFORE creating logger
if (process.env.SENTRY_DSN) {
  initSentry({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION,
  })
}

const logger = createLogger('knowledge-base-service')
const app = express()
const PORT = parseInt(process.env.PORT || '4005', 10)

// Trust proxy (required for Railway and other reverse proxies)
// Set to 1 for Railway's single reverse proxy (more secure than 'true')
app.set('trust proxy', 1)

// Middleware
app.use(helmet())
app.use(compression())
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
  })
)
app.use(express.json({ limit: '50mb' })) // Larger limit for document uploads

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// API routes
app.use('/api/documents', documentRoutes)

// Health check
app.get('/health', async (req, res) => {
  try {
    const { getQueueStats } = await import('./services/queue.js')
    const queueStats = await getQueueStats()
    res.json({
      status: 'ok',
      service: 'knowledge-base-service',
      queue: queueStats,
    })
  } catch (error) {
    res.json({
      status: 'ok',
      service: 'knowledge-base-service',
      queue: { error: 'Unable to fetch queue stats' },
    })
  }
})

// Error handling
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    handleError(err, res)
  }
)

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...')
  await closeQueue()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...')
  await closeQueue()
  process.exit(0)
})

async function start() {
  try {
    await initializeDatabase()

    app.listen(PORT, () => {
      logger.info(`Knowledge Base Service running on port ${PORT}`)
    })

    initializeProcessor()
    
    const supabase = getSupabase()
    const { data: pendingDocuments, error } = await supabase
      .from('knowledge_base_documents')
      .select('id')
      .eq('status', 'pending')
      .limit(100)

    if (error) {
      logger.error('Failed to fetch pending documents', { error })
    } else if (pendingDocuments && pendingDocuments.length > 0) {
      const enqueuePromises = pendingDocuments.map(async (doc) => {
        if (doc?.id) {
          try {
            await Promise.race([
              enqueueDocument(doc.id),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Enqueue timeout')), 5000)
              )
            ])
          } catch (error) {
            logger.warn(`Failed to enqueue document ${doc.id}`, { error })
          }
        }
      })
      
      Promise.all(enqueuePromises).catch((error) => {
        logger.warn('Some documents failed to enqueue', { error })
      })
    }
  } catch (error) {
    logger.error('Failed to start service', { error })
    process.exit(1)
  }
}

start()

