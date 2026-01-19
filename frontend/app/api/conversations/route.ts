/**
 * Next.js API Route - Conversations Proxy
 * Proxies requests to Chat Service with authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { proxyRequest } from '@/lib/api/proxy'
import { logger } from '@/lib/utils/logger'

const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'http://localhost:4004'

export async function GET(request: NextRequest) {
  if (!CHAT_SERVICE_URL || CHAT_SERVICE_URL.includes('localhost')) {
    logger.warn('CHAT_SERVICE_URL not properly configured', { 
      CHAT_SERVICE_URL,
      hasEnvVar: !!process.env.CHAT_SERVICE_URL,
    })
  }

  return withAuth(request, async (req, ctx) => {
    try {
      return await proxyRequest(req, ctx, {
        serviceUrl: CHAT_SERVICE_URL,
        path: '/api/conversations',
      })
    } catch (error) {
      logger.error('Conversations API proxy error', { error, url: req.url })
      return NextResponse.json(
        { error: 'Failed to fetch conversations', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      )
    }
  })
}

