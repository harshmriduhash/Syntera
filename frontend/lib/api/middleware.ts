/**
 * API Route Middleware
 * 
 * Provides shared authentication and request handling for Next.js API routes.
 * Wraps API route handlers with Supabase authentication and extracts user context.
 * 
 * Features:
 * - Supabase JWT token verification
 * - User session management
 * - Optional company association enforcement
 * - Consistent error handling
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

export interface AuthenticatedContext {
  user: { id: string; email: string }
  session: { access_token: string }
  companyId?: string | null
}

export interface WithAuthOptions {
  requireCompany?: boolean
}

/**
 * Wrap API Route Handler with Authentication
 * 
 * Higher-order function that provides authentication for Next.js API routes.
 * Verifies Supabase JWT tokens, extracts user information, and optionally
 * enforces company association.
 * 
 * @param request - Next.js request object
 * @param handler - Route handler function that receives authenticated context
 * @param options - Configuration options (e.g., requireCompany)
 * @returns NextResponse with handler result or authentication error
 */
export async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest, ctx: AuthenticatedContext) => Promise<NextResponse>,
  options: WithAuthOptions = {}
): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      return NextResponse.json({ error: 'No session token' }, { status: 401 })
    }

    // Get company_id if required
    let companyId: string | null | undefined = undefined
    if (options.requireCompany) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle()

      if (userError) {
        logger.warn('Failed to retrieve user company association', {
          error: userError.message,
          userId: user.id,
        })
        // Continue execution: company_id may be null for new users
      }

      companyId = userData?.company_id || null

      if (options.requireCompany && !companyId) {
        logger.warn('Company association required but not found', {
          userId: user.id,
          userEmail: user.email,
        })
        return NextResponse.json(
          { error: 'User company not found' },
          { status: 400 }
        )
      }
    }

    const ctx: AuthenticatedContext = {
      user: {
        id: user.id,
        email: user.email || '',
      },
      session: {
        access_token: session.access_token,
      },
      companyId,
    }

    return await handler(request, ctx)
  } catch (error) {
    logger.error('Authentication middleware encountered unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      path: request.nextUrl.pathname,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




