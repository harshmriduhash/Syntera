/**
 * Pinecone Service
 * Manages vector storage and retrieval
 */

import { Pinecone } from '@pinecone-database/pinecone'
import { createLogger } from '@syntera/shared/logger/index.js'
import { getPinecone } from '../config/database.js'

const logger = createLogger('knowledge-base-service:pinecone')

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'syntera-knowledge-base'
const NAMESPACE_PREFIX = 'company'

/**
 * Get or create Pinecone index
 */
export async function getIndex(companyId?: string) {
  const pinecone = getPinecone()
  if (!pinecone) {
    throw new Error('Pinecone not initialized')
  }

  try {
    const index = pinecone.Index(INDEX_NAME)
    return { index, namespace: companyId ? `${NAMESPACE_PREFIX}-${companyId}` : undefined }
  } catch (error) {
    logger.error('Failed to get Pinecone index', { error })
    throw error
  }
}

export async function upsertVectors(
  vectors: Array<{
    id: string
    values: number[]
    metadata: Record<string, unknown>
  }>,
  companyId: string
): Promise<boolean> {
  const pinecone = getPinecone()
  if (!pinecone) {
    logger.warn('Pinecone not initialized - skipping vector storage')
    return false
  }

  try {
    const { index, namespace } = await getIndex(companyId)
    
    const records = vectors.map((v) => {
      const cleanMetadata: Record<string, string | number | boolean> = {}
      for (const [key, value] of Object.entries(v.metadata)) {
        if (value !== null && value !== undefined) {
          cleanMetadata[key] = value as string | number | boolean
        }
      }
      
      return {
        id: v.id,
        values: v.values,
        metadata: cleanMetadata,
      }
    })
    
    if (namespace) {
      await index.namespace(namespace).upsert(records)
    } else {
      await index.upsert(records)
    }
    
    return true
  } catch (error) {
    logger.error('Failed to upsert vectors', { error })
    throw error
  }
}

/**
 * Delete vectors by IDs
 */
export async function deleteVectors(vectorIds: string[], companyId: string) {
  const { index, namespace } = await getIndex(companyId)

  try {
    const indexNamespace = namespace ? index.namespace(namespace) : index
    
    if ('deleteMany' in indexNamespace && typeof (indexNamespace as { deleteMany?: (ids: string[]) => Promise<void> }).deleteMany === 'function') {
      await (indexNamespace as { deleteMany: (ids: string[]) => Promise<void> }).deleteMany(vectorIds)
    } else if ('delete1' in indexNamespace && typeof (indexNamespace as { delete1?: (ids: string[]) => Promise<void> }).delete1 === 'function') {
      await (indexNamespace as { delete1: (ids: string[]) => Promise<void> }).delete1(vectorIds)
    } else {
      logger.warn('Delete method not available in this Pinecone version')
      return
    }
  } catch (error) {
    logger.error('Failed to delete vectors', { error })
    throw error
  }
}

/**
 * Search for similar vectors
 */
export async function searchVectors(
  queryVector: number[],
  companyId: string,
  topK: number = 10,
  filter?: Record<string, unknown>
) {
  const { index, namespace } = await getIndex(companyId)

  try {
    const queryOptions: {
      vector: number[]
      topK: number
      includeMetadata: boolean
      filter?: Record<string, unknown>
    } = {
      vector: queryVector,
      topK,
      includeMetadata: true,
    }
    
    if (filter && Object.keys(filter).length > 0) {
      queryOptions.filter = filter
    }
    
    const results = namespace
      ? await index.namespace(namespace).query(queryOptions)
      : await index.query(queryOptions)

    return results.matches || []
  } catch (error) {
    logger.error('Failed to search vectors', { error })
    throw error
  }
}