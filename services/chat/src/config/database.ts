/**
 * Chat Service - Database Configuration
 */

import { connectMongoDB } from '@syntera/shared/database/mongodb.js'
import { createRedisClient } from '@syntera/shared/database/redis.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('chat-service')

// Redis client for caching and pub/sub
export const redis = createRedisClient(process.env.REDIS_URL!)

export async function initializeDatabase() {
  try {
    const mongoUri = process.env.MONGO_URL
    if (mongoUri) {
      try {
        await connectMongoDB(mongoUri)
        logger.info('MongoDB connected')
      } catch (error: any) {
        if (error?.message?.includes('ETIMEDOUT') || 
            error?.message?.includes('ECONNREFUSED') ||
            error?.message?.includes('ENOTFOUND')) {
          logger.warn('MongoDB connection failed - service will continue without MongoDB')
        } else {
          throw error
        }
      }
    } else {
      logger.warn('MONGO_URL not set - running without MongoDB')
    }

    setTimeout(() => {
      if (redis && redis.status === 'ready') {
        logger.info('Redis connected')
      }
    }, 1000)
  } catch (error) {
    logger.error('Database initialization failed', { error })
  }
}

