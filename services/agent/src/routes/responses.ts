/**
 * Agent Response Generation Routes
 * 
 * Handles AI agent response generation for authenticated users.
 * Supports knowledge base integration, intent detection, sentiment analysis,
 * and workflow triggers based on detected intents.
 * 
 * Features:
 * - Attachment processing for multimodal inputs
 * - Knowledge base context retrieval
 * - Intent-based prompt enhancement
 * - Sentiment-aware responses
 * - Workflow automation triggers
 */

import express, { Request, Response } from 'express'
import { authenticate, requireCompany, AuthenticatedRequest } from '../middleware/auth.js'
import { generateResponse } from '../services/openai.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { processAttachments } from '../utils/attachments.js'
import { detectIntent, getIntentBasedPromptEnhancement } from '../utils/intent-detection.js'
import { analyzeSentiment, getSentimentBasedPromptEnhancement } from '../utils/sentiment-analysis.js'
import { getAgentConfig } from '../utils/agent-cache.js'
import type { AgentConfig } from '../types/agent.js'
import { searchKnowledgeBase } from '../utils/knowledge-base.js'
import { z } from 'zod'

const logger = createLogger('agent-service:responses')
const router: express.Router = express.Router()

// Request schema
const GenerateResponseSchema = z.object({
  agentId: z.string().uuid('Invalid agent ID'),
  message: z.string().min(1, 'Message is required').max(5000, 'Message too long'),
  conversationId: z.string().optional(), // Optional: used to load conversation metadata
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(),
  includeKnowledgeBase: z.boolean().optional().default(true),
  attachments: z.array(z.object({
    url: z.string(),
    type: z.string(),
    name: z.string(),
    size: z.number().optional(),
  })).optional(),
})

/**
 * POST /api/responses/generate
 * 
 * Generates an AI agent response for a user message with optional context.
 * 
 * Supports:
 * - Conversation history for context-aware responses
 * - Knowledge base integration for domain-specific answers
 * - Attachment processing (images, documents, etc.)
 * - Intent detection and sentiment analysis
 * - Workflow automation based on detected intents
 * 
 * @route POST /api/responses/generate
 * @requires Authentication and company association
 */
router.post(
  '/generate',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate input
      const validationResult = GenerateResponseSchema.safeParse(req.body)
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: validationResult.error.issues[0].message,
        })
      }

      const { agentId, message, conversationId, conversationHistory, includeKnowledgeBase, attachments } = validationResult.data
      const companyId = req.user!.company_id!
      
      // Log attachment processing if present
      if (attachments && attachments.length > 0) {
        logger.info('Processing message with file attachments', {
          attachmentCount: attachments.length,
          attachmentNames: attachments.map(a => a.name),
          agentId,
          companyId,
        })
      }

      // Retrieve agent configuration (uses caching for performance)
      const agentData = await getAgentConfig(agentId, companyId)

      if (!agentData || !agentData.enabled) {
        logger.warn('Agent not found or disabled', {
          agentId,
          companyId,
          enabled: agentData?.enabled,
        })
        return res.status(404).json({ error: 'Agent not found or disabled' })
      }

      const agent = agentData

      // Load conversation metadata and contact information if conversationId is provided
      let collectedContactInfo: {
        email?: string
        phone?: string
        first_name?: string
        last_name?: string
        name?: string
      } = {}
      let conversationContactId: string | undefined = undefined
      
      if (conversationId) {
        try {
          const { Conversation } = await import('@syntera/shared/models/index.js')
          const conversation = await Conversation.findById(conversationId).lean()
          const conversationMetadata = conversation?.metadata || {}
          
          // Get contactId from conversation
          if (conversation?.contact_id) {
            conversationContactId = conversation.contact_id
          }
          
          if (conversationMetadata.email) collectedContactInfo.email = conversationMetadata.email as string
          if (conversationMetadata.phone) collectedContactInfo.phone = conversationMetadata.phone as string
          if (conversationMetadata.first_name) collectedContactInfo.first_name = conversationMetadata.first_name as string
          if (conversationMetadata.last_name) collectedContactInfo.last_name = conversationMetadata.last_name as string
          if (conversationMetadata.first_name || conversationMetadata.last_name) {
            collectedContactInfo.name = [conversationMetadata.first_name, conversationMetadata.last_name]
              .filter(Boolean)
              .join(' ')
          }
        } catch (error) {
          logger.warn('Failed to load conversation metadata for response generation', {
            error: error instanceof Error ? error.message : String(error),
            conversationId,
            agentId,
          })
        }
      }

      // Search knowledge base in parallel with other operations
      // Use timeout to prevent blocking if knowledge base service is slow
      const KB_SEARCH_TIMEOUT = 500 // 500ms timeout for knowledge base queries
      const knowledgeBasePromise = includeKnowledgeBase
        ? Promise.race([
            searchKnowledgeBase({
              query: message,
              companyId,
              agentId: agent.id,
              topK: 5,
              maxResults: 3,
            }),
            new Promise<undefined>((resolve) => 
              setTimeout(() => resolve(undefined), KB_SEARCH_TIMEOUT)
            ),
          ]).catch((error) => {
            logger.warn('Knowledge base search failed or timed out', {
              error: error instanceof Error ? error.message : String(error),
              agentId,
              companyId,
            })
            return undefined
          })
        : Promise.resolve(undefined)

      // Run intent detection and sentiment analysis in parallel
      // These operations are independent and can execute concurrently
      const [intentResult, sentimentResult] = await Promise.allSettled([
        detectIntent(message).catch((error) => {
          logger.warn('Intent detection failed', {
            error: error instanceof Error ? error.message : String(error),
            agentId,
          })
          return null
        }),
        analyzeSentiment(message).catch((error) => {
          logger.warn('Sentiment analysis failed', {
            error: error instanceof Error ? error.message : String(error),
            agentId,
          })
          return null
        }),
      ])

      // Extract results (handle both fulfilled and rejected promises)
      const intent = intentResult.status === 'fulfilled' ? intentResult.value : null
      const sentiment = sentimentResult.status === 'fulfilled' ? sentimentResult.value : null

      // Process intent results and trigger workflows (async, don't block)
      let intentEnhancement = ''
      if (intent) {
        intentEnhancement = getIntentBasedPromptEnhancement(intent.intent)
        
        // Trigger workflows if purchase intent detected (async, don't block)
        if (intent.intent === 'purchase' && intent.confidence >= 0.8) {
          const { executeWorkflowsForTrigger } = await import('../services/workflow-executor.js')
          const triggerConversationId = conversationId || 
                                        (req.body as any).conversationId ||
                                        undefined
          
          if (triggerConversationId) {
            executeWorkflowsForTrigger('purchase_intent', {
              triggered_by: 'message',
              triggered_by_id: triggerConversationId,
              conversationId: triggerConversationId,
              agentId,
              companyId,
              contactId: conversationContactId,
              intent: intent.intent,
              confidence: intent.confidence,
              message,
            }, companyId).catch((error) => {
              logger.error('Failed to execute workflows triggered by purchase intent', {
                error: error instanceof Error ? error.message : String(error),
                conversationId: triggerConversationId,
                agentId,
                companyId,
              })
            })
          }
        }

        // Trigger message_received workflows for all messages (async, don't block)
        const { executeWorkflowsForTrigger } = await import('../services/workflow-executor.js')
        const workflowConversationId = conversationId || 
                                       (req.body as any).conversationId ||
                                       undefined
        
        if (workflowConversationId) {
          executeWorkflowsForTrigger('message_received', {
            triggered_by: 'message',
            triggered_by_id: workflowConversationId,
            conversationId: workflowConversationId,
            agentId,
            companyId,
            message,
            channel: 'chat',
          }, companyId).catch((error) => {
            logger.error('Failed to execute workflows triggered by message_received event', {
              error: error instanceof Error ? error.message : String(error),
              conversationId: workflowConversationId,
              agentId,
              companyId,
            })
          })
        }
      }

      // Process sentiment results
      let sentimentEnhancement = ''
      if (sentiment) {
        sentimentEnhancement = getSentimentBasedPromptEnhancement(sentiment.sentiment, sentiment.score)
      }

      // Enhance system prompt with intent and sentiment-based guidance
      let enhancedSystemPrompt = agent.system_prompt
      
      // Add collected contact information to system prompt so agent knows what's already been provided
      const contactInfoParts: string[] = []
      if (collectedContactInfo.name) contactInfoParts.push(`Name: ${collectedContactInfo.name}`)
      if (collectedContactInfo.email) contactInfoParts.push(`Email: ${collectedContactInfo.email}`)
      if (collectedContactInfo.phone) contactInfoParts.push(`Phone: ${collectedContactInfo.phone}`)
      
      if (contactInfoParts.length > 0) {
        enhancedSystemPrompt += `\n\nCOLLECTED CONTACT INFORMATION (DO NOT ASK FOR THESE AGAIN):
${contactInfoParts.join('\n')}

IMPORTANT: The user has already provided this contact information. DO NOT ask for it again. Reference it naturally when appropriate (e.g., "I'll send the details to ${collectedContactInfo.email || 'you'}"), but never ask "What's your email?" or similar questions.`
      }
      
      if (intentEnhancement) {
        enhancedSystemPrompt += `\n\n${intentEnhancement}`
      }
      if (sentimentEnhancement) {
        enhancedSystemPrompt += `\n\n${sentimentEnhancement}`
      }

      const enhancedMessage = await processAttachments(message, attachments)
      
      // Wait for knowledge base search (with timeout already handled)
      const knowledgeBaseContext = await knowledgeBasePromise
      
      // Generate response using OpenAI service
      // Knowledge base restriction instructions are added in generateResponse() function
      const result = await generateResponse({
        systemPrompt: enhancedSystemPrompt,
        userMessage: enhancedMessage,
        conversationHistory,
        knowledgeBaseContext,
        model: agent.model || 'gpt-4o-mini',
        temperature: agent.temperature || 0.7,
        maxTokens: agent.max_tokens || 800,
      })

      res.json({
        response: result.response,
        metadata: {
          agentId: agent.id,
          model: result.model,
          tokensUsed: result.tokensUsed,
          knowledgeBaseUsed: !!knowledgeBaseContext,
          intent: intent ? {
            category: intent.intent,
            confidence: intent.confidence,
          } : undefined,
          sentiment: sentiment ? {
            sentiment: sentiment.sentiment,
            score: sentiment.score,
            confidence: sentiment.confidence,
            emotions: sentiment.emotions,
          } : undefined,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to generate response', { error: errorMessage })
      res.status(500).json({ error: 'Failed to generate response' })
    }
  }
)

export default router

