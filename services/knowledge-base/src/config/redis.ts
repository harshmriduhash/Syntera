/**
 * Redis Configuration
 * Connects to Redis for BullMQ job queue
 */

import Redis from 'ioredis'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('knowledge-base-service:redis')

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required')
    }
    
    const isTLS = redisUrl.startsWith('rediss://') || process.env.REDIS_TLS === 'true'
    
    // Parse URL to extract connection details
    const urlObj = new URL(redisUrl)
    const host = urlObj.hostname
    const port = parseInt(urlObj.port || '6379', 10)
    const password = urlObj.password || (urlObj.searchParams.get('password') || undefined)
    
    // For Railway internal URLs, ensure proper connection
    const isRailwayInternal = host.includes('railway.internal')
    
    redis = new Redis({
      host,
      port,
      password,
      family: 4, // Force IPv4 to avoid IPv6 issues
      maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
      tls: isTLS ? {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      } : undefined,
      connectTimeout: 30000, // Increased timeout for Railway internal network
      enableReadyCheck: true, // Enable ready check for better connection validation
      enableOfflineQueue: false, // Disable offline queue to fail fast if not connected
      lazyConnect: false, // Connect immediately to catch errors early
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000)
        if (times > 30) { // More retries for Railway network
          logger.warn('Redis connection retry limit reached', { attempts: times })
          return null
        }
        return delay
      },
      reconnectOnError: (err) => {
        // Reconnect on network errors, but not on auth errors
        const targetErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET']
        if (targetErrors.some(error => err.message.includes(error))) {
          return true
        }
        // Don't reconnect on auth errors
        if (err.message.includes('NOAUTH') || err.message.includes('invalid password')) {
          logger.error('Redis authentication failed', { error: err.message })
          return false
        }
        return false
      },
    })

    redis.on('error', (error) => {
      logger.error('Redis connection error', { 
        error: error.message,
        host,
        port,
        isRailwayInternal 
      })
    })

    redis.on('connect', () => {
      logger.info('Redis connecting', { host, port, isRailwayInternal })
    })

    redis.on('ready', () => {
      logger.info('Redis connection ready', { host, port, isRailwayInternal })
    })

    redis.on('close', () => {
      logger.warn('Redis connection closed', { host, port })
    })

    redis.on('reconnecting', (delay) => {
      logger.info('Redis reconnecting', { host, port, delay })
    })
  }

  return redis
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
  }
}

