/**
 * Authentication Middleware
 * 
 * Provides JWT-based authentication for authenticated API endpoints.
 * Verifies Supabase JWT tokens and extracts user and company information.
 * 
 * Features:
 * - Supabase JWT token verification
 * - User profile retrieval
 * - Automatic company creation for new users
 * - Company association enforcement
 */

import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/database.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service')

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    company_id: string | null
  }
}

/**
 * Middleware to verify Supabase JWT token and extract user info
 * 
 * Verifies the Bearer token from Authorization header, extracts user information,
 * and attaches it to the request object. Requires valid Supabase JWT token.
 * 
 * @param req - Express request with AuthenticatedRequest interface
 * @param res - Express response
 * @param next - Express next function
 * @returns 401 if token is missing/invalid, otherwise calls next()
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
      logger.warn('Missing or invalid authorization header')
      return res.status(401).json({ error: 'Missing or invalid authorization header' })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      logger.warn('JWT token verification failed', {
        error: authError?.message,
        path: req.path,
      })
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    
    logger.debug('JWT token verified successfully', { userId: user.id })

    // Retrieve user's company association from database
    // Use maybeSingle() to handle cases where user doesn't exist in users table yet
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      logger.warn('Failed to retrieve user profile for company association', {
        error: profileError.message,
        userId: user.id,
      })
      // Continue execution: company_id may be null for new users (will be created by requireCompany)
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email || '',
      company_id: userProfile?.company_id || null,
    }

    next()
  } catch (error) {
    logger.error('Authentication middleware encountered unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
    })
    return res.status(500).json({ error: 'Authentication error' })
  }
}

/**
 * Middleware to ensure user has a company_id
 * 
 * Checks if the authenticated user has a company_id. If not, automatically
 * creates a new company for the user. This ensures all users belong to a company.
 * 
 * @param req - Express request with authenticated user
 * @param res - Express response
 * @param next - Express next function
 * @returns 401 if not authenticated, otherwise calls next()
 */
export async function requireCompany(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  // If user already has a company_id, proceed
  if (req.user.company_id) {
    return next()
  }

  // Auto-create a company for the user
  try {
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: `${req.user.email.split('@')[0]}'s Company`,
        owner_id: req.user.id,
        subscription_tier: 'starter',
      })
      .select('id')
      .single()

    if (companyError || !company) {
      logger.error('Failed to auto-create company for new user', {
        error: companyError?.message,
        userId: req.user.id,
        userEmail: req.user.email,
      })
      return res.status(500).json({ 
        error: 'Failed to create company. Please contact support.' 
      })
    }

    // Associate user with the newly created company
    const { error: updateError } = await supabase
      .from('users')
      .upsert({
        id: req.user.id,
        email: req.user.email,
        company_id: company.id,
      })

    if (updateError) {
      logger.error('Failed to associate user with newly created company', {
        error: updateError.message,
        userId: req.user.id,
        companyId: company.id,
      })
      return res.status(500).json({ 
        error: 'Failed to associate user with company' 
      })
    }

    // Update request context with the new company_id
    req.user.company_id = company.id
    logger.info('Auto-created company and associated with user', {
      userId: req.user.id,
      companyId: company.id,
      companyName: `${req.user.email.split('@')[0]}'s Company`,
    })

    next()
  } catch (error) {
    logger.error('requireCompany middleware encountered unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
    })
    return res.status(500).json({ error: 'Internal server error' })
  }
}

