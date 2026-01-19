/**
 * Embeddings Service
 * Creates vector embeddings using OpenAI
 */

import OpenAI from 'openai'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('knowledge-base-service:embeddings')

let openai: OpenAI | null = null

export function initializeOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set - embeddings will be disabled')
    return null
  }

  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  return openai
}

export function getOpenAI() {
  return openai
}

/**
 * Create embeddings for text chunks
 */
export async function createEmbeddings(
  texts: string[],
  model: string = 'text-embedding-3-small'
): Promise<number[][]> {
  if (!openai) {
    throw new Error('OpenAI client not initialized')
  }

  try {
    const dimensions = model === 'text-embedding-3-small' ? 1024 : undefined
    const timeoutMs = 30000
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Embedding creation timeout after ${timeoutMs}ms`))
      }, timeoutMs)
    })
    
    const embeddingPromise = openai.embeddings.create({
      model,
      input: texts,
      ...(dimensions && { dimensions }),
    })

    const response = await Promise.race([embeddingPromise, timeoutPromise])
    return response.data.map((item) => item.embedding)
  } catch (error) {
    logger.error('Failed to create embeddings', { error, batchSize: texts.length })
    throw error
  }
}

/**
 * Create a single embedding
 */
export async function createEmbedding(
  text: string,
  model: string = 'text-embedding-3-small'
): Promise<number[]> {
  const embeddings = await createEmbeddings([text], model)
  return embeddings[0]
}


