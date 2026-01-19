/**
 * Next.js API Route - CRM Contact Detail
 * Handles single contact operations (GET, PATCH, DELETE)
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let contactId: string | undefined
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
    contactId = id

    // Get contact
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
      }
      logger.error('Error fetching contact', { error, contactId: id, companyId: userData.company_id })
      return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 })
    }

    return NextResponse.json({ contact })
  } catch (error) {
    logger.error('Contact API error', { error, method: 'GET', contactId })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let contactId: string | undefined
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
    contactId = id
    const body = await request.json()

    // Build update object, filtering out undefined values and converting empty strings to null
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Only include fields that are explicitly provided (not undefined)
    if (body.email !== undefined) {
      updateData.email = body.email === '' ? null : body.email
    }
    if (body.phone !== undefined) {
      updateData.phone = body.phone === '' ? null : body.phone
    }
    if (body.first_name !== undefined) {
      updateData.first_name = body.first_name === '' ? null : body.first_name
    }
    if (body.last_name !== undefined) {
      updateData.last_name = body.last_name === '' ? null : body.last_name
    }
    if (body.company_name !== undefined) {
      updateData.company_name = body.company_name === '' ? null : body.company_name
    }
    if (body.tags !== undefined) {
      updateData.tags = Array.isArray(body.tags) && body.tags.length > 0 ? body.tags : []
    }
    if (body.metadata !== undefined) {
      updateData.metadata = body.metadata && Object.keys(body.metadata).length > 0 ? body.metadata : {}
    }

    // Update contact
    const { data: contact, error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
      }
      logger.error('Error updating contact', { error, contactId: id, updateData, companyId: userData.company_id })
      return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
    }

    return NextResponse.json({ contact })
  } catch (error) {
    logger.error('Contact API error', { error, method: 'PATCH', contactId })
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
  let contactId: string | undefined
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
    contactId = id

    // Delete contact
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('company_id', userData.company_id)

    if (error) {
      logger.error('Error deleting contact', { error, contactId: id, companyId: userData.company_id })
      return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Contact API error', { error, method: 'DELETE', contactId })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

