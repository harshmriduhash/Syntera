/**
 * Database Configuration
 * Connects to Supabase (PostgreSQL) and Pinecone
 */

import { getSupabaseClient, verifySupabaseConnection } from '@syntera/shared/database/supabase.js'
import { Pinecone } from '@pinecone-database/pinecone'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('knowledge-base-service:database')

export function getSupabase() {
  return getSupabaseClient()
}

// Pinecone client
let pinecone: Pinecone | null = null

export async function initializePinecone() {
  try {
    if (!process.env.PINECONE_API_KEY) {
      logger.warn('PINECONE_API_KEY not set - Pinecone features will be disabled')
      return null
    }

    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    })

    const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'syntera-knowledge-base'
    const index = pinecone.Index(INDEX_NAME)
    await index.describeIndexStats()

    return pinecone
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to initialize Pinecone', { error: errorMessage })
    logger.warn('Pinecone features will be disabled - document processing will work but vectors won\'t be stored')
    pinecone = null
    return null
  }
}

export function getPinecone() {
  return pinecone
}

export async function initializeDatabase() {
  try {
    // Verify Supabase connection (client is initialized lazily)
    await verifySupabaseConnection('knowledge_base_documents')

    await initializePinecone()
  } catch (error) {
    logger.error('Database initialization failed', { error })
    throw error
  }
}

