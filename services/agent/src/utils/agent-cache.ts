/**
 * Agent Configuration Caching
 * Caches agent configs in Redis to reduce database queries
 */

import { getRedis } from '../config/database.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { supabase } from '../config/database.js'
import type { AgentConfig } from '../types/agent.js'

const logger = createLogger('agent-service:agent-cache')

const CACHE_TTL = 5 * 60 // 5 minutes in seconds
const CACHE_KEY_PREFIX = 'agent:config:'

/**
 * Get agent configuration from cache or database
 * 
 * CRITICAL: companyId is REQUIRED for data isolation.
 * This ensures agents can only be accessed by users from the same company.
 * 
 * @param agentId - Agent UUID
 * @param companyId - Company UUID (REQUIRED for security)
 * @returns AgentConfig or null if not found or doesn't belong to company
 */
export async function getAgentConfig(
  agentId: string,
  companyId: string
): Promise<AgentConfig | null> {
  if (!companyId) {
    logger.error('getAgentConfig called without companyId - security violation', { agentId })
    throw new Error('companyId is required for agent access')
  }

  const redis = getRedis()
  // Include company_id in cache key to prevent cross-company cache hits
  const cacheKey = `${CACHE_KEY_PREFIX}${companyId}:${agentId}`

  // Try to get from cache
  if (redis) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        const agent = JSON.parse(cached) as AgentConfig
        // Double-check company_id matches (defense in depth)
        if (agent.company_id === companyId) {
          return agent
        } else {
          logger.warn('Cached agent config has mismatched company_id - invalidating cache', {
            agentId,
            expectedCompanyId: companyId,
            cachedCompanyId: agent.company_id,
          })
          await redis.del(cacheKey)
        }
      }
    } catch (error) {
      logger.warn('Failed to read from cache', { error, agentId, companyId })
      // Continue to database lookup
    }
  }

  // Fetch from database - ALWAYS filter by company_id
  try {
    const { data: agent, error } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('id', agentId)
      .eq('company_id', companyId) // CRITICAL: Always filter by company_id
      .single()

    if (error || !agent) {
      logger.debug('Agent not found or access denied', {
        agentId,
        companyId,
        error: error?.message,
      })
      return null
    }

    // Verify company_id matches (defense in depth)
    if (agent.company_id !== companyId) {
      logger.error('Agent company_id mismatch - potential security issue', {
        agentId,
        expectedCompanyId: companyId,
        actualCompanyId: agent.company_id,
      })
      return null
    }

    // Cache with company_id in key
    if (redis) {
      try {
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(agent))
      } catch (cacheError) {
        logger.warn('Failed to cache agent config', { error: cacheError, agentId, companyId })
      }
    }

    return agent as AgentConfig
  } catch (error) {
    logger.error('Failed to fetch agent config', { error, agentId, companyId })
    return null
  }
}

/**
 * Invalidate agent config cache
 * 
 * @param agentId - Agent UUID
 * @param companyId - Company UUID (optional, but recommended for precise cache invalidation)
 */
export async function invalidateAgentConfig(
  agentId: string,
  companyId?: string
): Promise<void> {
  const redis = getRedis()
  if (!redis) {
    return
  }

  try {
    if (companyId) {
      // Invalidate specific company's cache entry
      const cacheKey = `${CACHE_KEY_PREFIX}${companyId}:${agentId}`
    await redis.del(cacheKey)
    } else {
      // Fallback: Try to invalidate old-format cache key (for backward compatibility)
      const oldCacheKey = `${CACHE_KEY_PREFIX}${agentId}`
      await redis.del(oldCacheKey)
      
      // Also try to find and delete all company-specific keys for this agent
      // This is a best-effort cleanup - we can't easily scan all keys in Redis
      logger.debug('Invalidating agent cache without company_id - may leave stale entries', {
        agentId,
      })
    }
  } catch (error) {
    logger.warn('Failed to invalidate agent config cache', { error, agentId, companyId })
  }
}

