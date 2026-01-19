/**
 * Analysis Routes
 * Endpoints for batch processing conversations for threading and sentiment
 */

import express, { Request, Response } from 'express'
import { authenticate, requireCompany, AuthenticatedRequest } from '../middleware/auth.js'
import { batchProcessConversations } from '../services/threading-analyzer.js'
import { Conversation } from '@syntera/shared/models/index.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { z } from 'zod'

const logger = createLogger('agent-service:analysis')
const router = express.Router()

const BatchProcessSchema = z.object({
  conversationIds: z.array(z.string()).optional(),
  analyzeThreading: z.boolean().optional().default(true),
  analyzeSentiment: z.boolean().optional().default(true),
  filter: z
    .object({
      status: z.enum(['active', 'ended', 'archived']).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().optional().default(100),
    })
    .optional(),
})

/**
 * POST /api/analysis/batch-process
 * Batch process conversations for auto-threading and sentiment analysis
 */
router.post(
  '/batch-process',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validationResult = BatchProcessSchema.safeParse(req.body)
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationResult.error.issues,
        })
      }

      const { conversationIds, analyzeThreading, analyzeSentiment, filter } =
        validationResult.data
      const companyId = req.user!.company_id!

      let targetConversationIds: string[] = []

      if (conversationIds && conversationIds.length > 0) {
        // Process specific conversations
        targetConversationIds = conversationIds
      } else if (filter) {
        // Find conversations based on filter
        const query: any = {
          company_id: companyId,
        }

        if (filter.status) {
          query.status = filter.status
        }

        if (filter.dateFrom || filter.dateTo) {
          query.created_at = {}
          if (filter.dateFrom) {
            query.created_at.$gte = new Date(filter.dateFrom)
          }
          if (filter.dateTo) {
            query.created_at.$lte = new Date(filter.dateTo)
          }
        }

        const conversations = await Conversation.find(query)
          .limit(filter.limit || 100)
          .select('_id')
          .lean()

        targetConversationIds = conversations.map((c) => c._id.toString())
      } else {
        return res.status(400).json({
          error: 'Either conversationIds or filter must be provided',
        })
      }

      if (targetConversationIds.length === 0) {
        return res.json({
          message: 'No conversations found to process',
          results: {
            processed: 0,
            threadingResults: 0,
            sentimentResults: 0,
            errors: 0,
          },
        })
      }

      logger.info('Starting batch processing', {
        companyId,
        conversationCount: targetConversationIds.length,
        analyzeThreading,
        analyzeSentiment,
      })

      // Process conversations
      const results = await batchProcessConversations(targetConversationIds, {
        analyzeThreading,
        analyzeSentiment,
      })

      logger.info('Batch processing completed', {
        companyId,
        results,
      })

      res.json({
        message: 'Batch processing completed',
        results,
      })
    } catch (error) {
      logger.error('Failed to batch process conversations', { error })
      res.status(500).json({ error: 'Failed to process conversations' })
    }
  }
)

/**
 * POST /api/analysis/process-ended
 * Process all ended conversations that haven't been analyzed yet
 */
router.post(
  '/process-ended',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = req.user!.company_id!
      const { analyzeThreading = true, analyzeSentiment = true, limit = 50 } = req.body

      // Find ended conversations without sentiment analysis
      const query: any = {
        company_id: companyId,
        status: 'ended',
        $or: [
          { 'metadata.sentiment_analyzed_at': { $exists: false } },
          { 'metadata.sentiment_analyzed_at': null },
        ],
      }

      const conversations = await Conversation.find(query)
        .limit(limit)
        .select('_id')
        .lean()

      const conversationIds = conversations.map((c) => c._id.toString())

      if (conversationIds.length === 0) {
        return res.json({
          message: 'No unprocessed ended conversations found',
          results: {
            processed: 0,
            threadingResults: 0,
            sentimentResults: 0,
            errors: 0,
          },
        })
      }

      logger.info('Processing ended conversations', {
        companyId,
        count: conversationIds.length,
      })

      const results = await batchProcessConversations(conversationIds, {
        analyzeThreading,
        analyzeSentiment,
      })

      res.json({
        message: 'Processing completed',
        results,
      })
    } catch (error) {
      logger.error('Failed to process ended conversations', { error })
      res.status(500).json({ error: 'Failed to process conversations' })
    }
  }
)

export default router

