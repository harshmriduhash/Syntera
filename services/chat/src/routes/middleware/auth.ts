/**
 * REST API Authentication Middleware
 * Verifies Supabase JWT tokens for REST endpoints
 */

import { Request, Response, NextFunction } from 'express'
import { getSupabaseClient } from '@syntera/shared/database/supabase.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('chat-service:api:auth')

const supabase = getSupabaseClient()

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    company_id: string | null
  }
}

/**
 * Middleware to verify Supabase JWT token and extract user info
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      logger.warn('Authentication failed', { error: authError?.message })
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      logger.warn('Failed to fetch user profile', { error: profileError.message })
    }
    req.user = {
      id: user.id,
      email: user.email || '',
      company_id: userProfile?.company_id || null,
    }

    next()
  } catch (error) {
    logger.error('Authentication middleware error', { error })
    return res.status(500).json({ error: 'Authentication error' })
  }
}

/**
 * Middleware to ensure user has a company_id
 */
export async function requireCompany(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  if (!req.user.company_id) {
    return res.status(400).json({ 
      error: 'User must be associated with a company. Please contact support.' 
    })
  }

  next()
}


