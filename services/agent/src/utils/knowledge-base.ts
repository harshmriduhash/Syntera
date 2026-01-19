/**
 * Knowledge Base Service Utilities
 * Handles knowledge base search and context retrieval
 */

import { fetchWithTimeout } from './fetch-with-timeout.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:knowledge-base')

const KNOWLEDGE_BASE_SERVICE_URL = process.env.KNOWLEDGE_BASE_SERVICE_URL
if (!KNOWLEDGE_BASE_SERVICE_URL) {
  throw new Error('KNOWLEDGE_BASE_SERVICE_URL environment variable is required')
}
const DEFAULT_TIMEOUT = 10000 // 10 seconds

export interface KnowledgeBaseSearchOptions {
  query: string
  companyId: string
  agentId: string
  topK?: number
  maxResults?: number
}

export interface KnowledgeBaseResult {
  text: string
  score?: number
}

/**
 * Search knowledge base and return formatted context string
 * 
 * Queries the Knowledge Base Service for relevant documents using vector search.
 * Returns a formatted context string that can be injected into AI prompts.
 * 
 * @param options - Search options
 * @param options.query - Search query text
 * @param options.companyId - Company ID to filter documents
 * @param options.agentId - Agent ID to filter documents
 * @param options.topK - Number of top results to retrieve (default: 5)
 * @param options.maxResults - Maximum results to include in context (default: 3)
 * @returns Formatted context string with document excerpts, or undefined if no results
 */
export async function searchKnowledgeBase(
  options: KnowledgeBaseSearchOptions
): Promise<string | undefined> {
  const { query, companyId, agentId, topK = 5, maxResults = 3 } = options

  try {
    const searchResponse = await fetchWithTimeout(
      `${KNOWLEDGE_BASE_SERVICE_URL}/api/documents/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          companyId,
          agentId,
          topK,
        }),
      },
      DEFAULT_TIMEOUT
    )

    if (!searchResponse.ok) {
      return undefined
    }

    const searchData = (await searchResponse.json()) as {
      results?: Array<{ metadata?: { [key: string]: unknown }; score?: number }>
    }

    if (!searchData.results || searchData.results.length === 0) {
      return undefined
    }

    // Format knowledge base results as context
    const contextTexts = searchData.results
      .slice(0, maxResults)
      .map((result) => {
        const text = result.metadata?.text
        return typeof text === 'string' ? text : ''
      })
      .filter((text: string) => text.length > 0)

    if (contextTexts.length === 0) {
      return undefined
    }

    return contextTexts.join('\n\n---\n\n')
  } catch (error) {
    logger.warn('Failed to retrieve knowledge base context', {
      error: error instanceof Error ? error.message : String(error),
      query: query.substring(0, 50),
    })
    return undefined
  }
}






