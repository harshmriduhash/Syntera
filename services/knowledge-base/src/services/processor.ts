/**
 * Document Processor
 * Processes documents from the queue: extracts text, chunks, creates embeddings, stores in Pinecone
 * Uses streaming processing to minimize memory usage
 */

import { createLogger } from '@syntera/shared/logger/index.js'
import { getSupabase } from '../config/database.js'
import { extractText } from './extractor.js'
import { chunkText } from './chunker.js'
import { createEmbeddings, initializeOpenAI } from './embeddings.js'
import { upsertVectors, deleteVectors } from './pinecone.js'
import { PROCESSING_CONSTANTS } from '../config/constants.js'

/**
 * Find the nearest sentence boundary around the given index
 * Helper function for window processing
 */
function findSentenceBoundary(text: string, index: number): number {
  const sentenceEndings = ['. ', '.\n', '! ', '!\n', '? ', '?\n']
  let bestIndex = index

  // Look backwards (prefer earlier boundary)
  for (let i = index; i > index - 500 && i >= 0; i--) {
    for (const ending of sentenceEndings) {
      if (text.slice(i, i + ending.length) === ending) {
        return i + ending.length
      }
    }
  }

  // Look forwards if no backward match found
  for (let i = index; i < index + 500 && i < text.length; i++) {
    for (const ending of sentenceEndings) {
      if (text.slice(i, i + ending.length) === ending) {
        return i + ending.length
      }
    }
  }

  return bestIndex
}

const logger = createLogger('knowledge-base-service:processor')

export async function processDocument(documentId: string, job?: { updateProgress: (progress: number) => Promise<void> }) {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Document processing timeout after ${PROCESSING_CONSTANTS.TIMEOUT_MS / 1000} seconds`))
    }, PROCESSING_CONSTANTS.TIMEOUT_MS)
  })
  
    try {
    await Promise.race([
      processDocumentInternal(documentId, job),
      timeoutPromise,
    ])
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Failed to process document ${documentId}`, { 
      error: errorMessage
    })

    try {
      const supabase = getSupabase()
      await supabase
        .from('knowledge_base_documents')
        .update({
          status: 'failed',
          metadata: {
            error: errorMessage,
            failed_at: new Date().toISOString(),
          },
        } as Record<string, unknown>)
        .eq('id', documentId)
    } catch (updateError) {
      logger.error(`Failed to update document status to failed for ${documentId}`, { error: updateError })
    }
    throw error
  }
}

async function processDocumentInternal(documentId: string, job?: { updateProgress: (progress: number) => Promise<void> }) {
  const supabase = getSupabase()

    await supabase
      .from('knowledge_base_documents')
      .update({ status: 'processing' } as Record<string, unknown>)
      .eq('id', documentId)

    // Fetch document metadata
    interface DocumentRow {
      id: string
      file_size?: number
      file_path?: string
      mime_type?: string
      file_type?: string
      company_id: string
      agent_id?: string
      name?: string
      metadata?: Record<string, unknown>
      [key: string]: unknown
    }
    
    const { data: document, error: docError } = await supabase
      .from('knowledge_base_documents')
      .select('*')
      .eq('id', documentId)
      .single<DocumentRow>()

    if (docError || !document) {
      throw new Error(`Document not found: ${documentId}`)
    }

    // Check file size before processing
    if (document.file_size && document.file_size > PROCESSING_CONSTANTS.MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File size (${(document.file_size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${PROCESSING_CONSTANTS.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)`
      )
    }

    // Download file from Supabase Storage
    if (!document.file_path) {
      throw new Error('Document file_path is missing')
    }
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`)
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const extracted = await extractText(buffer, document.mime_type || document.file_type || '')
    
    // Clear buffer immediately after extraction to free memory
    buffer.fill(0)
    // Note: arrayBuffer will be GC'd after buffer is cleared

    // Check extracted text size
    if (extracted.text.length > PROCESSING_CONSTANTS.MAX_TEXT_LENGTH) {
      throw new Error(
        `Extracted text is too large (${(extracted.text.length / 1024 / 1024).toFixed(2)}MB). Maximum allowed: ${PROCESSING_CONSTANTS.MAX_TEXT_LENGTH / 1024 / 1024}MB`
      )
    }

    // STREAMING PROCESSING: Process text in very small windows to minimize memory
    // We process immediately and discard, never keeping more than one small window in memory
    // Smaller windows = less memory per iteration, but more iterations
    const STREAMING_WINDOW_SIZE = document.file_size && document.file_size > 5 * 1024 * 1024
      ? 30 // Large files: even smaller windows (30 chunks = ~30KB)
      : 50 // Small files: 50 chunks (~50KB)
    const EMBEDDING_BATCH_SIZE = document.file_size && document.file_size > 5 * 1024 * 1024
      ? PROCESSING_CONSTANTS.BATCH_SIZE_LARGE // Large files: smaller batches
      : PROCESSING_CONSTANTS.BATCH_SIZE_SMALL // Small files: larger batches
    
    let totalChunks = 0
    let totalVectorsProcessed = 0
    let globalChunkIndex = 0
    
    // Save metadata before processing
    const extractedMetadata = { ...extracted.metadata }
    
    // Get text length before we start processing
    const textLength = extracted.text.length
    
    // STREAMING: Process text in very small windows, clearing immediately
    let windowStart = 0
    let windowNumber = 0

    while (windowStart < textLength) {
      windowNumber++
      
      // Calculate window end - much smaller windows for streaming
      const estimatedWindowSize = STREAMING_WINDOW_SIZE * 1000 // ~50KB per window
      let windowEnd = Math.min(windowStart + estimatedWindowSize, textLength)
      
      // STREAMING: Extract window text first (small slice)
      // We'll extend to sentence boundary using only this window text
      let windowText = extracted.text.slice(windowStart, Math.min(windowStart + estimatedWindowSize + 1000, textLength))
      
      // Extend to sentence boundary using only the window text (not full text)
      if (windowEnd < textLength) {
        const localSentenceEnd = findSentenceBoundary(windowText, windowText.length - 100) // Look near end of window
        if (localSentenceEnd > 0) {
          windowEnd = windowStart + localSentenceEnd
          windowText = extracted.text.slice(windowStart, windowEnd) // Re-slice with correct boundary
        }
      } else {
        windowText = extracted.text.slice(windowStart, windowEnd)
      }
      
      // Chunk this window
      const windowChunks = chunkText(windowText, 1000, 200)
      
      // Adjust chunk indices to be global
      const adjustedChunks = windowChunks.map((chunk, idx) => ({
        ...chunk,
        index: globalChunkIndex + idx,
        startIndex: windowStart + chunk.startIndex,
        endIndex: windowStart + chunk.endIndex,
      }))
      
      globalChunkIndex += adjustedChunks.length
      totalChunks += adjustedChunks.length
      
      // Extract texts and metadata
      const windowChunkTexts = adjustedChunks.map(chunk => chunk.text)
      const windowChunkMetadata = adjustedChunks.map(chunk => ({
        index: chunk.index,
        startIndex: chunk.startIndex,
        endIndex: chunk.endIndex,
      }))
      
      // STREAMING: Clear chunks immediately - we have the data we need
      adjustedChunks.length = 0
      windowChunks.length = 0
      // windowText will be GC'd after this iteration
      
      // Process window chunks in embedding batches
      for (let i = 0; i < windowChunkTexts.length; i += EMBEDDING_BATCH_SIZE) {
        const batchStart = i
        const batchEnd = Math.min(i + EMBEDDING_BATCH_SIZE, windowChunkTexts.length)
        
        const batchChunkTexts = windowChunkTexts.slice(batchStart, batchEnd)
        const batchChunkMetadata = windowChunkMetadata.slice(batchStart, batchEnd)
        
        const batchNumber = Math.floor(i / EMBEDDING_BATCH_SIZE) + 1
        
        // Create embeddings for this batch
        const embeddings = await createEmbeddings(batchChunkTexts)

        // Create vectors
        const batchVectors = batchChunkMetadata.map((meta, batchIndex) => ({
          id: `${documentId}-chunk-${meta.index}`,
          values: embeddings[batchIndex],
          metadata: {
            document_id: documentId,
            company_id: document.company_id,
            agent_id: document.agent_id || '',
            chunk_index: meta.index,
            start_index: meta.startIndex,
            end_index: meta.endIndex,
            file_name: document.name || '',
            // CRITICAL: Store the actual chunk text in metadata so it can be retrieved during search
            text: batchChunkTexts[batchIndex],
          },
        }))

        // Upsert to Pinecone immediately
        const upsertSuccess = await upsertVectors(batchVectors, document.company_id)
        if (upsertSuccess) {
          totalVectorsProcessed += batchVectors.length
        } else {
          logger.warn(`Skipped vector storage for batch (Pinecone not available)`, {
            window: windowNumber,
            batch: batchNumber,
          })
        }
        
        // STREAMING: Clear batch data immediately after upsert
        batchVectors.length = 0
        embeddings.length = 0
        batchChunkTexts.length = 0
        batchChunkMetadata.length = 0
      }
      
      // STREAMING: Clear window data immediately
      windowChunkTexts.length = 0
      windowChunkMetadata.length = 0
      
      // Move to next window
      windowStart = windowEnd
      
      // Update job progress periodically
      if (job && windowNumber % 2 === 0) {
        const progress = Math.min(10 + Math.floor((windowStart / textLength) * 80), 90)
        await job.updateProgress(progress).catch(() => {
          // Ignore progress update errors
        })
      }
      
      // STREAMING: Force GC more frequently for large documents
      if (global.gc && windowNumber % 3 === 0) {
        global.gc()
        logger.debug(`Forced GC after processing window ${windowNumber}`, {
          totalChunks,
          windowNumber,
        })
      }
      
      // Small delay to prevent overwhelming the system
      if (windowStart < textLength) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
    
    // STREAMING: Clear extracted text reference after processing
    // Note: JavaScript strings are immutable, but clearing the reference helps GC
    // The string will be garbage collected when no longer referenced
    const _unused = extracted.text // Keep reference until end, then it will be GC'd
    extracted.text = '' as any // Clear reference to help GC
    
    logger.info(`Completed streaming processing in ${windowNumber} windows`, {
      documentId,
      totalChunks,
      totalVectorsProcessed,
    })

    await supabase
      .from('knowledge_base_documents')
      .update({
        status: 'completed',
        chunk_count: totalChunks,
        vector_count: totalVectorsProcessed,
        metadata: {
          ...document.metadata,
          extracted: {
            pageCount: extractedMetadata.pageCount,
            wordCount: extractedMetadata.wordCount,
            characterCount: extractedMetadata.characterCount,
          },
        },
        processed_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('id', documentId)
}

export function initializeProcessor() {
  initializeOpenAI()
}

