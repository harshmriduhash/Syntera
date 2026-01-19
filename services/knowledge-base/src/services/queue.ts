/**
 * Document Processing Queue
 * Uses BullMQ with Redis for job queue management, with in-memory fallback
 */

import { Queue, Worker, Job } from 'bullmq'
import { createLogger } from '@syntera/shared/logger/index.js'
import { getRedis } from '../config/redis.js'
import { processDocument } from './processor.js'

const logger = createLogger('knowledge-base-service:queue')

// Queue name
const QUEUE_NAME = 'document-processing'

// Get Redis connection
const redisConnection = getRedis()

/**
 * Wait for Redis to be ready by testing with PING
 */
async function waitForRedisReady(): Promise<void> {
  const maxAttempts = 60 // Increased for Railway network
  const delayMs = 500
  
  // First, wait for connection status to be 'ready' or 'connecting'
  let statusCheckAttempts = 0
  while (redisConnection.status !== 'ready' && redisConnection.status !== 'connecting' && statusCheckAttempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 100))
    statusCheckAttempts++
  }
  
  // Then test with PING
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await Promise.race([
        redisConnection.ping(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('PING timeout')), 5000)
        )
      ])
      if (result === 'PONG') {
        logger.info('Redis connection verified', { 
          status: redisConnection.status,
          attempt 
        })
        return
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (attempt === maxAttempts) {
        logger.error('Redis connection timeout', {
          attempts: maxAttempts,
          status: redisConnection.status,
          error: errorMessage
        })
        throw new Error(`Redis connection timeout after ${maxAttempts} attempts. Status: ${redisConnection.status}. Error: ${errorMessage}`)
      }
      if (attempt % 10 === 0) {
        logger.warn('Redis connection still waiting', { 
          attempt, 
          maxAttempts,
          status: redisConnection.status 
        })
      }
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
}

// Lazy initialization - create Queue and Worker only when needed
let documentQueue: Queue | null = null
let documentWorker: Worker | null = null
let initializationPromise: Promise<void> | null = null

async function initializeQueue(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise
  }
  
  initializationPromise = (async () => {
    await waitForRedisReady()
    
    if (!documentQueue) {
      documentQueue = new Queue(QUEUE_NAME, {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            age: 24 * 3600,
            count: 1000,
          },
          removeOnFail: {
            age: 7 * 24 * 3600,
          },
        },
      })
    }
    
    if (!documentWorker) {
      documentWorker = new Worker(
        QUEUE_NAME,
        async (job: Job<{ documentId: string }>) => {
          const { documentId } = job.data
          
          try {
            await job.updateProgress(10)
            // Pass job for progress updates during processing
            await processDocument(documentId, job)
            await job.updateProgress(100)
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error(`Error processing job ${job.id}`, {
              documentId,
              error: errorMessage,
            })
            throw error
          }
        },
        {
          connection: redisConnection,
          concurrency: 2,
          // Increase stalled interval to allow long-running document processing
          // Default is 30 seconds, but large documents can take 5+ minutes
          maxStalledCount: 0, // Don't mark as stalled (we handle timeouts in processor)
          stalledInterval: 10 * 60 * 1000, // 10 minutes (longer than max processing time)
          lockDuration: 10 * 60 * 1000, // 10 minutes - how long job is locked to this worker
        }
      )
      
      documentWorker.on('failed', (job, err) => {
        logger.error(`Job ${job?.id} failed`, {
          documentId: job?.data?.documentId,
          error: err.message,
        })
      })
      
      documentWorker.on('error', (err) => {
        logger.error('Worker error', { error: err.message })
      })
    }
  })()
  
  return initializationPromise
}

// Export getters that initialize on first access
export function getDocumentQueue(): Queue {
  if (!documentQueue) {
    throw new Error('Queue not initialized. Call initializeQueue() first.')
  }
  return documentQueue
}

export function getDocumentWorker(): Worker {
  if (!documentWorker) {
    throw new Error('Worker not initialized. Call initializeQueue() first.')
  }
  return documentWorker
}

let inMemoryQueue: Array<{ documentId: string; timestamp: number }> = []
let isProcessingInMemory = false

async function processInMemoryQueue() {
  if (isProcessingInMemory || inMemoryQueue.length === 0) {
    return
  }

  isProcessingInMemory = true
  
  while (inMemoryQueue.length > 0) {
    const item = inMemoryQueue.shift()
    if (!item) break

    try {
      await processDocument(item.documentId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to process document ${item.documentId} from in-memory queue`, {
        error: errorMessage,
      })
    }
  }

  isProcessingInMemory = false
}

export async function enqueueDocument(documentId: string): Promise<Job | { id: string }> {
  try {
    await Promise.race([
      initializeQueue(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Queue initialization timeout')), 3000)
      )
    ])
    
    const queue = getDocumentQueue()
    
    const job = await Promise.race([
      queue.add(
        'process-document',
        { documentId },
        {
          jobId: `doc-${documentId}`,
          priority: 0,
        }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Enqueue timeout')), 2000)
      )
    ])
    
    return job
  } catch (error) {
    logger.warn(`BullMQ queue unavailable, using in-memory queue for document ${documentId}`, {
      error
    })
    
    if (inMemoryQueue.some(item => item.documentId === documentId)) {
      return { id: `in-memory-${documentId}` }
    }

    inMemoryQueue.push({
      documentId,
      timestamp: Date.now(),
    })

    processInMemoryQueue().catch((err) => {
      logger.error('Error processing in-memory queue', { error: err.message })
    })

    return { id: `in-memory-${documentId}` }
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  try {
    await initializeQueue()
    const queue = getDocumentQueue()
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ])

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      inMemoryQueue: inMemoryQueue.length,
    }
  } catch (error) {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      inMemoryQueue: inMemoryQueue.length,
    }
  }
}

/**
 * Close queue and worker connections
 */
export async function closeQueue(): Promise<void> {
  if (documentWorker) {
    await documentWorker.close()
  }
  if (documentQueue) {
    await documentQueue.close()
  }
}


