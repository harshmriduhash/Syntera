/**
 * Next.js API Route: Proxy to Agent Service Public API
 * Proxies public agent API calls to agent service with CORS support
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:4002'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined
  try {
    const resolvedParams = await params
    id = resolvedParams.id
    const authHeader = request.headers.get('authorization')

    // Proxy to agent service
    const response = await fetch(`${AGENT_SERVICE_URL}/api/public/agents/${id}`, {
      method: 'GET',
      headers: {
        ...(authHeader ? { 'Authorization': authHeader } : {}),
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    return NextResponse.json(data, {
      status: response.status,
      headers: corsHeaders,
    })
  } catch (error) {
    logger.error('Public API error proxying agent', { error, agentId: id })
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: corsHeaders }
    )
  }
}

