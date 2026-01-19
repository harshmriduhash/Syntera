/**
 * Next.js API Route - Mark All Notifications as Read
 * Proxies requests to Agent Service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:4002'

async function getAuthToken(supabase: any): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token || ''
}

export async function PATCH(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(`${AGENT_SERVICE_URL}/api/notifications/read-all`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${await getAuthToken(supabase)}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('Notification API error', { error, status: response.status })
      return NextResponse.json({ error: 'Failed to mark all as read' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    logger.error('Notifications API error', { error, method: 'PATCH' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

