/**
 * Next.js API Route - CRM Deals
 * Handles deal CRUD operations
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 404 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const stage = searchParams.get('stage')
    const contactId = searchParams.get('contact_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('deals')
      .select('*, contacts(*)', { count: 'exact' })
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Add filters
    if (stage) {
      query = query.eq('stage', stage)
    }
    if (contactId) {
      query = query.eq('contact_id', contactId)
    }

    const { data: deals, error, count } = await query

    if (error) {
      logger.error('Error fetching deals', { error, companyId: userData.company_id })
      return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 })
    }

    return NextResponse.json({
      deals: deals || [],
      total: count || 0,
    })
  } catch (error) {
    logger.error('Deals API error', { error, method: 'GET' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 404 })
    }

    const body = await request.json()
    const { contact_id, title, value, stage, probability, expected_close_date, metadata } = body

    // Create deal
    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        company_id: userData.company_id,
        contact_id: contact_id || null,
        title,
        value: value ? parseFloat(value) : null,
        stage: stage || 'lead',
        probability: probability || 0,
        expected_close_date: expected_close_date || null,
        metadata: metadata || {},
      })
      .select('*, contacts(*)')
      .single()

    if (error) {
      logger.error('Error creating deal', { error, body, companyId: userData.company_id })
      return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
    }

    // Trigger deal_created workflows
    try {
      const agentServiceUrl = process.env.AGENT_SERVICE_URL || 'http://localhost:4002'
      const { data: { session } } = await supabase.auth.getSession()
      const authToken = session?.access_token || ''

      await fetch(`${agentServiceUrl}/api/internal/workflows/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          trigger_type: 'deal_created',
          trigger_data: {
            triggered_by: 'deal',
            triggered_by_id: deal.id,
            dealId: deal.id,
            contactId: deal.contact_id,
            companyId: userData.company_id,
            stage: deal.stage,
            value: deal.value,
            title: deal.title,
          },
          company_id: userData.company_id,
        }),
      }).catch((error) => {
        logger.warn('Failed to trigger deal_created workflows', { error })
      })
    } catch (error) {
      logger.warn('Error triggering deal_created workflows', { error })
    }

    return NextResponse.json({ deal }, { status: 201 })
  } catch (error) {
    logger.error('Deals API error', { error, method: 'POST' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

