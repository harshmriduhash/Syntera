/**
 * Next.js API Route - Single Workflow
 * Proxies requests to Agent Service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:4002'

export async function GET(_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Forward to Agent Service
    const response = await fetch(`${AGENT_SERVICE_URL}/api/workflows/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await getAuthToken(supabase)}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('Workflow API error', { error, status: response.status })
      return NextResponse.json({ error: 'Failed to fetch workflow' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    logger.error('Workflow API error', { error, method: 'GET' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Forward to Agent Service
    const response = await fetch(`${AGENT_SERVICE_URL}/api/workflows/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${await getAuthToken(supabase)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('Workflow API error', { error, status: response.status })
      return NextResponse.json({ error: 'Failed to update workflow' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    logger.error('Workflow API error', { error, method: 'PATCH' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Forward to Agent Service
    const response = await fetch(`${AGENT_SERVICE_URL}/api/workflows/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${await getAuthToken(supabase)}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('Workflow API error', { error, status: response.status })
      return NextResponse.json({ error: 'Failed to delete workflow' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    logger.error('Workflow API error', { error, method: 'DELETE' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getAuthToken(supabase: any): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token || ''
}



