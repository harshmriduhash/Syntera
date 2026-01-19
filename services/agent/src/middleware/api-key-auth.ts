/**
 * API Key Authentication Middleware
 * 
 * Authenticates requests from the embeddable widget using API keys.
 * API keys follow the format: `pub_key_{agentId}` where `{agentId}` is a UUID.
 * 
 * This middleware:
 * - Extracts and validates API key format
 * - Verifies agent existence in the database
 * - Attaches agent and company context to the request
 * - Handles special routes that don't require agentId upfront
 * 
 * Used exclusively for public widget endpoints that don't require user authentication.
 */

import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/database.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:api-key-auth')

export interface ApiKeyRequest extends Request {
  apiKey?: string
  agentId?: string
  companyId?: string
}

/**
 * Authenticate Request Using API Key
 * 
 * Verifies the API key from the Authorization header and extracts
 * agent and company information for widget requests.
 * 
 * API Key Format: `pub_key_{agentId}` where agentId is a UUID
 * 
 * @param req - Express request (will be augmented with apiKey, agentId, companyId)
 * @param res - Express response
 * @param next - Express next function
 * @returns 401 if authentication fails, otherwise calls next()
 */
export async function authenticateApiKey(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) {
    // Skip authentication for CORS preflight requests
  if (req.method === 'OPTIONS') {
    return next()
  }

  try {
      // Extract API key from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Missing or invalid authorization header in API key request', {
          path: req.path,
          method: req.method,
        })
      return res.status(401).json({ error: 'Missing or invalid authorization header' })
    }

    const apiKey = authHeader.substring(7) // Remove 'Bearer ' prefix

      // Validate API key format: must start with 'pub_key_'
    if (!apiKey.startsWith('pub_key_')) {
        logger.warn('Invalid API key format', {
          apiKeyPrefix: apiKey.substring(0, 10) + '...',
          path: req.path,
        })
      return res.status(401).json({ error: 'Invalid API key format' })
    }

    // Extract agent ID from API key format: pub_key_{agentId}
    let agentId: string | undefined = undefined
    
    if (apiKey.startsWith('pub_key_')) {
      const extractedAgentId = apiKey.substring(8) // Remove 'pub_key_' prefix
        // Validate UUID format
      if (extractedAgentId && extractedAgentId.match(/^[a-f0-9-]{36}$/i)) {
        agentId = extractedAgentId
      }
    }
    
      // Identify routes that don't require agentId upfront
      // These routes will extract agentId from the conversation in the route handler
    const isRouteWithoutAgentId = req.path.includes('/messages') || 
                                   req.path.includes('/livekit/token') ||
                                   req.path.includes('/websocket/config') ||
                                   (req.path.includes('/conversations/') && req.method === 'PATCH')
    
    if (!agentId && !isRouteWithoutAgentId) {
        logger.warn('Agent ID required but not found in API key', {
          path: req.path,
          method: req.method,
        })
      return res.status(400).json({ error: 'Agent ID is required' })
    }
    
      // For routes without agentId, defer validation to route handler
      // The route handler will verify conversation ownership
    if (!agentId && isRouteWithoutAgentId) {
      req.apiKey = apiKey
      // agentId and companyId will be set by route handler after conversation lookup
      next()
      return
    }

    // Verify agent exists and get company_id
    const { data: agent, error: agentError } = await supabase
      .from('agent_configs')
      .select('id, company_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      logger.warn('Agent not found during API key authentication', { 
        agentId, 
        error: agentError?.message,
        errorCode: agentError?.code,
        path: req.path,
      })
      
      return res.status(404).json({ 
        error: 'Agent not found',
        agentId,
        details: agentError?.message || 'Agent does not exist',
        errorCode: agentError?.code || 'UNKNOWN',
      })
    }
    
    // Attach authentication context to request for use in route handlers
    req.apiKey = apiKey
    req.agentId = agentId
    req.companyId = agent.company_id

    next()
  } catch (error) {
    logger.error('API key authentication failed with unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
      method: req.method,
    })
    return res.status(500).json({ error: 'Authentication error' })
  }
}

