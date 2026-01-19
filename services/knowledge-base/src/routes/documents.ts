/**
 * Document API Routes
 */

import express, { Request, Response } from 'express'
import multer from 'multer'
import { createLogger } from '@syntera/shared/logger/index.js'
import { handleError, notFound, badRequest } from '@syntera/shared/utils/errors.js'
import { authenticate, requireCompany, type AuthenticatedRequest } from '../middleware/auth.js'
import { enqueueDocument, getQueueStats } from '../services/queue.js'
import { getSupabase } from '../config/database.js'
import { createEmbedding } from '../services/embeddings.js'
import { searchVectors } from '../services/pinecone.js'

const logger = createLogger('knowledge-base-service:routes:documents')
const router: express.Router = express.Router()

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
      'text/csv',
    ]
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('File type not supported. Allowed: PDF, DOC, DOCX, TXT, MD, CSV'))
    }
  },
})

/**
 * GET /api/documents
 * List documents for the authenticated user's company
 */
router.get(
  '/',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = req.user!.company_id!
      const agentId = req.query.agent_id as string | undefined

      const supabase = getSupabase()
      let query = supabase
        .from('knowledge_base_documents')
        .select('id, company_id, agent_id, name, file_name, file_path, file_size, file_type, mime_type, status, chunk_count, vector_count, metadata, created_at, updated_at, processed_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100)

      // Filter by agent_id if provided
      if (agentId) {
        query = query.eq('agent_id', agentId)
      }

      const { data: documents, error } = await query

      if (error) {
        logger.error('Failed to fetch documents', { error: error.message, companyId, agentId })
        return res.status(500).json({ error: 'Failed to fetch documents' })
      }

      res.json({ documents: documents || [] })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * POST /api/documents
 * Upload and create a new document
 */
router.post(
  '/',
  authenticate,
  requireCompany,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = req.user!.company_id!
      const file = req.file
      const agentId = (req.body.agent_id as string) || null

      if (!file) {
        return badRequest(res, 'No file provided')
      }

      const fileExt = file.originalname.split('.').pop() || 'txt'
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${companyId}/${fileName}`

      // Upload to Supabase Storage
      const supabase = getSupabase()
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        })

      if (uploadError) {
        logger.error('Failed to upload file', { error: uploadError.message })
        return res.status(500).json({ error: 'Failed to upload file' })
      }

      // Create database record
      const { data: document, error: dbError } = await supabase
        .from('knowledge_base_documents')
        .insert({
          company_id: companyId,
          agent_id: agentId,
          name: file.originalname,
          file_name: fileName,
          file_path: uploadData.path,
          file_size: file.size,
          file_type: file.mimetype,
          mime_type: file.mimetype,
          status: 'pending',
        })
        .select()
        .single()

      if (dbError) {
        // Clean up uploaded file if DB insert fails
        await supabase.storage.from('documents').remove([filePath])
        logger.error('Failed to create document record', { error: dbError.message })
        return res.status(500).json({ error: 'Failed to create document record' })
      }

      enqueueDocument(document.id).catch((error) => {
        logger.warn('Failed to enqueue document', { documentId: document.id, error })
      })

      res.status(201).json({
        success: true,
        document: {
          id: document.id,
          name: document.name,
          status: document.status,
          created_at: document.created_at,
        },
      })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
router.delete(
  '/:id',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!

      const supabase = getSupabase()

      // Get document to verify ownership and get file path
      // Need chunk_count for vector cleanup, so select it before deletion
      const { data: document, error: docError } = await supabase
        .from('knowledge_base_documents')
        .select('file_path, company_id, chunk_count')
        .eq('id', id)
        .single()

      if (docError || !document) {
        return notFound(res, 'Document', id)
      }

      if (document.company_id !== companyId) {
        return res.status(403).json({ error: 'Unauthorized' })
      }

      // CRITICAL: Delete vectors from Pinecone BEFORE deleting database record
      // This prevents orphaned vectors from remaining in Pinecone
      if (document.chunk_count && document.chunk_count > 0) {
        try {
          const { cleanupDocumentVectors } = await import('../services/cleanup.js')
          await cleanupDocumentVectors(id, companyId)
          logger.info('Deleted vectors from Pinecone', { documentId: id, chunkCount: document.chunk_count })
        } catch (cleanupError) {
          logger.error('Failed to cleanup vectors from Pinecone', {
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
            documentId: id,
          })
          // Continue with deletion even if vector cleanup fails (non-blocking)
        }
      }

      // Delete file from storage if it exists
      if (document.file_path) {
        await supabase.storage.from('documents').remove([document.file_path])
      }

      // Delete document record
      const { error: deleteError } = await supabase
        .from('knowledge_base_documents')
        .delete()
        .eq('id', id)

      if (deleteError) {
        logger.error('Failed to delete document', { error: deleteError.message, documentId: id })
        return res.status(500).json({ error: 'Failed to delete document' })
      }

      res.json({ success: true })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * POST /api/documents/:id/enqueue
 * Enqueue a document for processing
 */
router.post('/:id/enqueue', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Verify document exists
    const supabase = getSupabase()
    const { data: document, error } = await supabase
      .from('knowledge_base_documents')
      .select('id, status')
      .eq('id', id)
      .single()

    if (error || !document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    if (!document.status) {
      return res.status(400).json({ error: 'Document status not found' })
    }

    if (document.status !== 'pending') {
      return res.status(400).json({
        error: `Document is not pending (current status: ${document.status})`,
      })
    }

    // Enqueue the document
    const job = await enqueueDocument(id)

    res.json({
      success: true,
      jobId: job.id,
      documentId: id,
    })
  } catch (error) {
    logger.error('Failed to enqueue document', { error })
    res.status(500).json({ error: 'Failed to enqueue document' })
  }
})

/**
 * GET /api/documents/queue/stats
 * Get queue statistics
 */
router.get('/queue/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getQueueStats()
    const { getDocumentWorker } = await import('../services/queue.js')
    try {
      const worker = getDocumentWorker()
      res.json({
        ...stats,
        workerRunning: worker.isRunning(),
        workerPaused: worker.isPaused(),
      })
    } catch {
      res.json({
        ...stats,
        workerRunning: false,
        workerPaused: false,
      })
    }
  } catch (error) {
    logger.error('Failed to get queue stats', { error })
    res.status(500).json({ error: 'Failed to get queue stats' })
  }
})

/**
 * POST /api/documents/search
 * Search documents using semantic search
 */
router.post(
  '/search',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = req.user!.company_id!
      const { query, topK = 10, agentId } = req.body

      if (!query || typeof query !== 'string') {
        return badRequest(res, 'Query is required')
      }

    if (query.trim().length === 0) {
      return res.json({ results: [] })
    }

    const queryEmbedding = await createEmbedding(query)

    const filter: Record<string, unknown> | undefined = agentId
      ? { agent_id: agentId }
      : undefined

    const matches = await searchVectors(queryEmbedding, companyId, topK, filter)

    const results = matches.map((match) => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata || {},
    }))

    res.json({
        query,
        results,
        count: results.length,
      })
    } catch (error) {
      handleError(error, res)
    }
  }
)

export default router

