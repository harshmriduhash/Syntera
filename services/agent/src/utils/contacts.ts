/**
 * Contact Management Utilities
 * Handles finding and creating contacts from email/phone
 */

import { supabase } from '../config/database.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:contacts')

export interface ContactMetadata {
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  company_name?: string
  tags?: string[]
  [key: string]: unknown
}

export interface FindOrCreateContactOptions {
  companyId: string
  email?: string
  phone?: string
  metadata?: ContactMetadata
}

export interface FindOrCreateContactResult {
  contactId: string | null
  created: boolean
}

/**
 * Find existing contact by email or phone, or create new one
 * 
 * Uses a single query with OR condition to avoid N+1 problem.
 * Automatically triggers 'contact_created' workflow when a new contact is created.
 * 
 * @param options - Contact search/creation options
 * @param options.companyId - Company ID that owns the contact
 * @param options.email - Email address to search/create
 * @param options.phone - Phone number to search/create
 * @param options.metadata - Additional contact metadata (name, tags, etc.)
 * @returns Object with contactId and created flag
 */
export async function findOrCreateContact(
  options: FindOrCreateContactOptions
): Promise<FindOrCreateContactResult> {
  const { companyId, email, phone, metadata = {} } = options

  if (!email && !phone) {
    return { contactId: null, created: false }
  }

  try {
    // Single query to find contact by email OR phone (fixes N+1 problem)
    // Build OR condition dynamically
    const conditions: string[] = []
    if (email) conditions.push(`email.eq.${email}`)
    if (phone) conditions.push(`phone.eq.${phone}`)
    
    if (conditions.length === 0) {
      return { contactId: null, created: false }
    }
    
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('company_id', companyId)
      .or(conditions.join(','))
      .maybeSingle()

    if (existingContact) {
      logger.info('Found existing contact', {
        contactId: existingContact.id,
        email,
        phone,
      })
      return { contactId: existingContact.id, created: false }
    }

    // Create new contact
    const { data: newContact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        company_id: companyId,
        email: email || null,
        phone: phone || null,
        first_name: metadata.first_name || null,
        last_name: metadata.last_name || null,
        company_name: metadata.company_name || null,
        tags: metadata.tags || [],
        metadata: {
          source: 'widget',
          auto_created: true,
          ...metadata,
        },
      })
      .select('id')
      .single()

    if (contactError || !newContact) {
      logger.warn('Failed to create contact', {
        error: contactError,
        email,
        phone,
      })
      return { contactId: null, created: false }
    }

    // Trigger contact_created workflows
    try {
      const { executeWorkflowsForTrigger } = await import('../services/workflow-executor.js')
      executeWorkflowsForTrigger('contact_created', {
        triggered_by: 'contact',
        triggered_by_id: newContact.id,
        contactId: newContact.id,
        companyId,
        source: metadata.source as string || 'widget',
        email,
        phone,
        metadata,
      }, companyId).catch((error) => {
        logger.error('Failed to execute workflows for contact_created', { error })
      })
    } catch (error) {
      logger.warn('Failed to trigger contact_created workflows', { error })
    }

    logger.info('Auto-created contact', {
      contactId: newContact.id,
      email,
      phone,
    })
    return { contactId: newContact.id, created: true }
  } catch (error) {
    logger.error('Error finding/creating contact', { error, email, phone })
    return { contactId: null, created: false }
  }
}

/**
 * Update existing contact with new information
 * 
 * Automatically triggers 'contact_updated' workflow when contact is updated.
 * 
 * @param contactId - Contact ID to update
 * @param companyId - Company ID (for authorization)
 * @param updates - Partial contact metadata to update
 * @returns true if update succeeded, false otherwise
 */
export async function updateContact(
  contactId: string,
  companyId: string,
  updates: Partial<ContactMetadata>
): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (updates.first_name) updateData.first_name = updates.first_name
    if (updates.last_name) updateData.last_name = updates.last_name
    if (updates.company_name) updateData.company_name = updates.company_name

    const { error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', contactId)
      .eq('company_id', companyId)

    if (error) {
      logger.warn('Failed to update contact', { error, contactId })
      return false
    }

    // Trigger contact_updated workflows
    try {
      const { executeWorkflowsForTrigger } = await import('../services/workflow-executor.js')
      const fieldsChanged = Object.keys(updates).filter((key) => updates[key as keyof ContactMetadata] !== undefined)
      
      executeWorkflowsForTrigger('contact_updated', {
        triggered_by: 'contact',
        triggered_by_id: contactId,
        contactId,
        companyId,
        fields_changed: fieldsChanged,
        updates,
      }, companyId).catch((error) => {
        logger.error('Failed to execute workflows for contact_updated', { error })
      })
    } catch (error) {
      logger.warn('Failed to trigger contact_updated workflows', { error })
    }

    return true
  } catch (error) {
    logger.error('Error updating contact', { error, contactId })
    return false
  }
}

