/**
 * Cleanup Service
 * Handles cleanup of vectors when documents are deleted
 */

import { createLogger } from '@syntera/shared/logger/index.js'
import { getSupabase } from '../config/database.js'
import { deleteVectors } from './pinecone.js'

const logger = createLogger('knowledge-base-service:cleanup')

/**
 * Clean up vectors for a deleted document
 */
export async function cleanupDocumentVectors(documentId: string, companyId: string) {
  try {
    const supabase = getSupabase()
    interface DocumentRow {
      chunk_count?: number
      [key: string]: unknown
    }
    
    const { data: document } = await supabase
      .from('knowledge_base_documents')
      .select('chunk_count')
      .eq('id', documentId)
      .single<DocumentRow>()

    if (!document) {
      logger.warn(`Document ${documentId} not found for cleanup`)
      return
    }

    const vectorIds: string[] = []
    const chunkCount = typeof document.chunk_count === 'number' ? document.chunk_count : 0
    for (let i = 0; i < chunkCount; i++) {
      vectorIds.push(`${documentId}-chunk-${i}`)
    }

    if (vectorIds.length > 0) {
      await deleteVectors(vectorIds, companyId)
    }
  } catch (error) {
    logger.error(`Failed to cleanup vectors for document ${documentId}`, { error })
  }
}

