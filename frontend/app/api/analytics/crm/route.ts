/**
 * Analytics CRM API
 * 
 * Provides CRM performance metrics including:
 * - Contact-to-deal conversion rate
 * - Deal pipeline distribution by stage
 * - Total deal value by stage
 * 
 * @route GET /api/analytics/crm
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, ctx) => {
    try {
      if (!ctx.companyId) {
        return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
      }

      const supabase = await createClient()
      const searchParams = req.nextUrl.searchParams
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')

      // Build date-filtered queries for contacts and deals
      let contactsQuery = supabase
        .from('contacts')
        .select('id', { count: 'exact' })
        .eq('company_id', ctx.companyId)

      let dealsQuery = supabase
        .from('deals')
        .select('contact_id, stage, value', { count: 'exact' })
        .eq('company_id', ctx.companyId)

      if (startDate) {
        contactsQuery = contactsQuery.gte('created_at', startDate)
        dealsQuery = dealsQuery.gte('created_at', startDate)
      }
      if (endDate) {
        contactsQuery = contactsQuery.lte('created_at', endDate)
        dealsQuery = dealsQuery.lte('created_at', endDate)
      }

      // Retrieve contact count
      const { count: totalContacts, error: contactsError } = await contactsQuery

      if (contactsError) {
        logger.warn('Failed to retrieve contact count for CRM analytics', {
          error: contactsError.message,
          companyId: ctx.companyId,
        })
      }

      // Retrieve deal data with stage and value information
      const { data: deals, count: totalDeals, error: dealsError } = await dealsQuery

      if (dealsError) {
        logger.warn('Failed to retrieve deal data for CRM analytics', {
          error: dealsError.message,
          companyId: ctx.companyId,
        })
      }

      // Calculate contact-to-deal conversion rate
      // Count unique contacts that have associated deals
      const uniqueContactIds = new Set(
        (deals || []).map((d: { contact_id?: string }) => d.contact_id).filter(Boolean)
      )
      const contactToDealConversion =
        totalContacts && totalContacts > 0
          ? Math.round((uniqueContactIds.size / totalContacts) * 100)
          : 0

      // Aggregate deals by stage (count and total value)
      const dealsByStageMap = new Map<string, { count: number; value: number }>()
      ;(deals || []).forEach((deal: { stage: string; value?: number }) => {
        const stage = deal.stage || 'lead'
        const current = dealsByStageMap.get(stage) || { count: 0, value: 0 }
        dealsByStageMap.set(stage, {
          count: current.count + 1,
          value: current.value + (deal.value || 0),
        })
      })

      const dealsByStage = Array.from(dealsByStageMap.entries()).map(([stage, data]) => ({
        stage,
        count: data.count,
        value: data.value,
      }))

      return NextResponse.json({
        contactToDealConversion,
        dealsByStage,
      })
    } catch (error) {
      logger.error('Failed to fetch CRM analytics', {
        error: error instanceof Error ? error.message : String(error),
        companyId: ctx.companyId,
      })
      return NextResponse.json(
        { error: 'Failed to fetch CRM analytics' },
        { status: 500 }
      )
    }
  }, { requireCompany: true })
}

