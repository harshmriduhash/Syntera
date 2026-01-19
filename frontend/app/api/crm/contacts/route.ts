/**
 * Next.js API Route - CRM Contacts
 * Handles contact CRUD operations
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
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Add search filter if provided
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`
      )
    }

    const { data: contacts, error, count } = await query

    if (error) {
      logger.error('Error fetching contacts', { error, companyId: userData.company_id })
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
    }

    return NextResponse.json({
      contacts: contacts || [],
      total: count || 0,
    })
  } catch (error) {
    logger.error('Contacts API error', { error, method: 'GET' })
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

    // Build insert object - directly use values from body, only include fields that are present
    const insertData: Record<string, unknown> = {
      company_id: userData.company_id,
    }

    // Include fields that are present in the body (they should have values since form was filled)
    if ('first_name' in body) {
      insertData.first_name = body.first_name
    }
    if ('last_name' in body) {
      insertData.last_name = body.last_name
    }
    if ('email' in body) {
      insertData.email = body.email
    }
    if ('phone' in body) {
      insertData.phone = body.phone
    }
    if ('company_name' in body) {
      insertData.company_name = body.company_name
    }
    if ('tags' in body) {
      insertData.tags = body.tags
    }
    if ('metadata' in body) {
      insertData.metadata = body.metadata
    }

    // Create contact
    const { data: contact, error } = await supabase
      .from('contacts')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('Contact API error creating contact', { error, companyId: userData.company_id })
      return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
    }

    return NextResponse.json({ contact }, { status: 201 })
  } catch (error) {
    logger.error('Contacts API error', { error, method: 'POST' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

