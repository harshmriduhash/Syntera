/**
 * Internal API Routes
 * For service-to-service communication
 */

import { Router, Request, Response, NextFunction } from 'express'
import { executeWorkflowsForTrigger } from '../services/workflow-executor.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { extractContactInfoLLM } from '../utils/contact-extractor-llm.js'
import { findOrCreateContact, updateContact } from '../utils/contacts.js'
import { Conversation, Message } from '@syntera/shared/models/index.js'

const logger = createLogger('agent-service:internal')
const router = Router()

/**
 * POST /api/internal/workflows/trigger
 * Trigger workflows from external services (Next.js API routes)
 */
router.post('/workflows/trigger', async (req, res) => {
  try {
    const { trigger_type, trigger_data, company_id } = req.body

    if (!trigger_type || !trigger_data || !company_id) {
      return res.status(400).json({
        error: 'Missing required fields: trigger_type, trigger_data, company_id',
      })
    }

    await executeWorkflowsForTrigger(trigger_type, trigger_data, company_id)

    res.json({ success: true })
  } catch (error: any) {
    logger.error('Failed to trigger workflows', { error: error?.message })
    res.status(500).json({ error: 'Failed to trigger workflows' })
  }
})

/**
 * POST /api/webhooks/:company_id/:workflow_id/:webhook_path
 * Webhook endpoint for webhook triggers
 */
router.post('/webhooks/:company_id/:workflow_id/:webhook_path', async (req, res) => {
  try {
    const { company_id, workflow_id, webhook_path } = req.params
    const webhookPayload = req.body
    const headers = req.headers

    // Get workflow to verify webhook_path and secret
    const { getWorkflow } = await import('../services/workflow.js')
    const workflow = await getWorkflow(workflow_id, company_id)

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' })
    }

    if (!workflow.enabled) {
      return res.status(400).json({ error: 'Workflow is disabled' })
    }

    if (workflow.trigger_type !== 'webhook') {
      return res.status(400).json({ error: 'Workflow is not a webhook trigger' })
    }

    const config = workflow.trigger_config as Record<string, unknown>
    const expectedPath = config.webhook_path as string
    const secret = config.secret as string | undefined

    if (expectedPath !== webhook_path) {
      return res.status(404).json({ error: 'Webhook path mismatch' })
    }

    // Verify secret if configured
    if (secret) {
      const providedSecret = headers['x-webhook-secret'] || headers['authorization']?.toString().replace('Bearer ', '')
      if (providedSecret !== secret) {
        return res.status(401).json({ error: 'Invalid webhook secret' })
      }
    }

    // Execute workflow
    const { executeWorkflow } = await import('../services/workflow-executor.js')
    await executeWorkflow(workflow, {
      triggered_by: 'webhook',
      triggered_by_id: workflow_id,
      webhook_path: webhook_path,
      payload: webhookPayload,
      headers: headers,
      method: req.method,
    }, workflow.company_id)

    res.json({ success: true, message: 'Webhook received and workflow triggered' })
  } catch (error: any) {
    logger.error('Webhook error', { error: error?.message })
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

// Simple token validation for internal service calls
function validateInternalToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN || 'internal-token'
  
  if (token !== expectedToken) {
    logger.warn('Invalid internal service token', { provided: token?.substring(0, 10) + '...' })
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  next()
}

/**
 * POST /api/internal/contacts/extract
 * Extract contact information from message and create/update contact
 * Used by Chat Service for Socket.io messages
 */
router.post('/contacts/extract', validateInternalToken, async (req, res) => {
  try {
    const { conversationId, messageContent, companyId, conversationContext } = req.body

    if (!conversationId || !messageContent || !companyId) {
      return res.status(400).json({
        error: 'Missing required fields: conversationId, messageContent, companyId',
      })
    }

    // Extract contact info using LLM
    const extracted = await extractContactInfoLLM(
      messageContent,
      conversationContext || []
    )

    // Skip if nothing extracted
    if (!extracted.email && !extracted.phone && !extracted.first_name && !extracted.last_name && !extracted.company_name) {
      return res.json({ success: true, extracted: null })
    }

    // Get conversation
    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    // Get current conversation metadata and merge with extracted info
    const currentMetadata = conversation.metadata || {}
    const updatedMetadata = {
      ...currentMetadata,
      // Only add extracted fields if not already present
      ...(extracted.email && !currentMetadata.email ? { email: extracted.email } : {}),
      ...(extracted.phone && !currentMetadata.phone ? { phone: extracted.phone } : {}),
      ...(extracted.first_name && !currentMetadata.first_name ? { first_name: extracted.first_name } : {}),
      ...(extracted.last_name && !currentMetadata.last_name ? { last_name: extracted.last_name } : {}),
      ...(extracted.company_name && !currentMetadata.company_name ? { company_name: extracted.company_name } : {}),
    }

    // Update conversation metadata
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: { metadata: updatedMetadata },
    })

    // If we have email or phone, create/update contact
    const email = (updatedMetadata.email as string) || extracted.email
    const phone = (updatedMetadata.phone as string) || extracted.phone

    let contactId: string | null = null
    let contactCreated = false

    if (email || phone) {
      // Find or create contact
      const contactResult = await findOrCreateContact({
        companyId,
        email,
        phone,
        metadata: updatedMetadata,
      })

      contactId = contactResult.contactId
      contactCreated = contactResult.created

      if (contactResult.contactId) {
        // Update contact if we have new extracted info
        if (!contactResult.created && extracted) {
          const updates: Record<string, string> = {}
          if (extracted.first_name && !updatedMetadata.first_name) {
            updates.first_name = extracted.first_name
          }
          if (extracted.last_name && !updatedMetadata.last_name) {
            updates.last_name = extracted.last_name
          }
          if (extracted.company_name && !updatedMetadata.company_name) {
            updates.company_name = extracted.company_name
          }

          if (Object.keys(updates).length > 0) {
            await updateContact(contactResult.contactId, companyId, updates)
          }
        }

        // Link conversation to contact if not already linked
        if (!conversation.contact_id) {
          await Conversation.findByIdAndUpdate(conversationId, {
            $set: { contact_id: contactResult.contactId },
          })

          logger.info('Linked conversation to contact', {
            conversationId,
            contactId: contactResult.contactId,
          })
        }
      }
    }

    res.json({
      success: true,
      extracted: {
        email: extracted.email,
        phone: extracted.phone,
        first_name: extracted.first_name,
        last_name: extracted.last_name,
        company_name: extracted.company_name,
      },
      contactId,
      contactCreated,
    })
  } catch (error: any) {
    logger.error('Failed to extract contact info', { error: error?.message })
    res.status(500).json({ error: 'Failed to extract contact info' })
  }
})

export default router

