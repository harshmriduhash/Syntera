/**
 * Next.js API Route - CRM Deal Detail
 * Handles single deal operations (GET, PATCH, DELETE)
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let dealId: string | undefined
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

    const { id } = await params
    dealId = id

    // Get deal with contact info
    const { data: deal, error } = await supabase
      .from('deals')
      .select('*, contacts(*)')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
      }
      logger.error('Error fetching deal', { error, dealId: id, companyId: userData.company_id })
      return NextResponse.json({ error: 'Failed to fetch deal' }, { status: 500 })
    }

    return NextResponse.json({ deal })
  } catch (error) {
    logger.error('Deal API error', { error, method: 'GET', dealId })
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

    const { id } = await params
    const body = await request.json()

    // Get previous deal stage BEFORE update (if stage is being changed)
    let previousStage: string | null = null
    if (body.stage !== undefined) {
      const { data: previousDeal } = await supabase
        .from('deals')
        .select('stage')
        .eq('id', id)
        .eq('company_id', userData.company_id)
        .single()
      
      previousStage = previousDeal?.stage || null
    }

    // Update deal
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (body.title !== undefined) updateData.title = body.title
    if (body.value !== undefined) updateData.value = body.value ? parseFloat(body.value) : null
    if (body.stage !== undefined) updateData.stage = body.stage
    if (body.probability !== undefined) updateData.probability = body.probability
    if (body.expected_close_date !== undefined) updateData.expected_close_date = body.expected_close_date
    if (body.contact_id !== undefined) updateData.contact_id = body.contact_id || null
    if (body.metadata !== undefined) updateData.metadata = body.metadata

    const { data: deal, error } = await supabase
      .from('deals')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .select('*, contacts(*)')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
      }
      logger.error('Error updating deal', { error, dealId: id, companyId: userData.company_id })
      return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 })
    }

    // Trigger deal_stage_changed workflows if stage changed
    if (body.stage !== undefined && previousStage && previousStage !== deal.stage) {
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
            trigger_type: 'deal_stage_changed',
            trigger_data: {
              triggered_by: 'deal',
              triggered_by_id: id,
              dealId: id,
              contactId: deal.contact_id,
              companyId: userData.company_id,
              from_stage: previousStage,
              to_stage: deal.stage,
            },
            company_id: userData.company_id,
          }),
        }).catch((error) => {
          logger.warn('Failed to trigger deal_stage_changed workflows', { error })
        })
      } catch (error) {
        logger.warn('Error triggering deal_stage_changed workflows', { error })
      }
    }

    return NextResponse.json({ deal })
  } catch (error) {
    logger.error('Deal API error', { error, method: 'PATCH' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let dealId: string | undefined
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

    const { id } = await params
    dealId = id

    // Delete deal
    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', id)
      .eq('company_id', userData.company_id)

    if (error) {
      logger.error('Error deleting deal', { error, dealId: id, companyId: userData.company_id })
      return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Deal API error', { error, method: 'DELETE', dealId })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

