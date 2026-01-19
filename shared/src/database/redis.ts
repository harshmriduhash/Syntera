/**
 * Redis connection utility
 * Used by Chat Service and Agent Service
 */

import Redis from 'ioredis'

let redisClient: Redis | null = null
let lastErrorLogTime = 0
const ERROR_LOG_INTERVAL = 60000 // Only log errors once per minute

export function createRedisClient(uri: string): Redis {
  if (redisClient) {
    return redisClient
  }

  // Validate URI format
  if (!uri || uri.includes('${') || uri.includes('%7B')) {
    throw new Error(`Invalid Redis URI: environment variable not properly set (got: ${uri.substring(0, 50)})`)
  }

  const requiresTLS = uri.startsWith('rediss://') || uri.includes('upstash.io')
  
  const redisOptions: any = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000)
      if (times > 10) {
        return null
      }
      return delay
    },
    connectTimeout: 10000,
    lazyConnect: false,
  }

  if (requiresTLS) {
    redisOptions.tls = {
      rejectUnauthorized: true,
    }
  }

  try {
    const url = new URL(uri)
    redisOptions.host = url.hostname
    redisOptions.port = parseInt(url.port || '6379', 10)
    
    if (url.password) {
      redisOptions.password = url.password
    }
    
    if (url.username) {
      redisOptions.username = url.username
    }
    
    redisClient = new Redis(redisOptions)
  } catch (error) {
    redisClient = new Redis(uri, redisOptions)
  }

  redisClient.on('connect', () => {
    lastErrorLogTime = 0
  })

  redisClient.on('error', (error: Error) => {
    const now = Date.now()
    if (now - lastErrorLogTime > ERROR_LOG_INTERVAL) {
      if (!error.message.includes('ETIMEDOUT') && !error.message.includes('ECONNREFUSED')) {
        if (error.message.includes('WRONGPASS')) {
          console.error('❌ Redis authentication failed:', error.message)
        } else {
          console.error('❌ Redis connection error:', error.message)
        }
      }
      lastErrorLogTime = now
    }
  })

  return redisClient
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call createRedisClient first.')
  }
  return redisClient
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}

