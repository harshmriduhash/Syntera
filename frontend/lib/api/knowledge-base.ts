'use client'

import { useQuery, type QueryKey } from '@tanstack/react-query'
import { useSimpleMutation } from '@/hooks/use-optimistic-mutation'

export interface KnowledgeBaseDocument {
  id: string
  company_id: string
  agent_id: string | null
  name: string
  file_name: string
  file_path: string
  file_size: number | null
  file_type: string | null
  mime_type: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  chunk_count: number
  vector_count: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  processed_at: string | null
}

export interface UploadDocumentResponse {
  success: boolean
  document: {
    id: string
    name: string
    status: string
    created_at: string
  }
}

export interface SearchResult {
  id: string
  score: number
  metadata: {
    document_id?: string
    company_id?: string
    agent_id?: string | null
    chunk_index?: number
    start_index?: number
    end_index?: number
    file_name?: string
  }
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  count: number
}

async function fetchDocuments(agentId?: string): Promise<KnowledgeBaseDocument[]> {
  const url = agentId 
    ? `/api/knowledge-base?agent_id=${agentId}`
    : '/api/knowledge-base'
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch documents')
  }
  const data = await response.json()
  return data.documents || []
}

async function uploadDocument(
  file: File,
  agentId?: string
): Promise<UploadDocumentResponse> {
  const formData = new FormData()
  formData.append('file', file)
  if (agentId) {
    formData.append('agent_id', agentId)
  }

  const response = await fetch('/api/knowledge-base/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to upload document')
  }

  return response.json()
}

async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`/api/knowledge-base/${documentId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete document')
  }
}

export function useDocuments(agentId?: string) {
  return useQuery({
    queryKey: ['knowledge-base', 'documents', agentId],
    queryFn: () => fetchDocuments(agentId),
    refetchInterval: (query) => {
      const data = query.state.data as KnowledgeBaseDocument[] | undefined
      if (!data) return false
      
      const hasActiveProcessing = data.some(
        (doc) => doc.status === 'pending' || doc.status === 'processing'
      )
      
      return hasActiveProcessing ? 5000 : false
    },
    staleTime: 10000,
    refetchOnWindowFocus: false,
  })
}

export function useUploadDocument() {
  return useSimpleMutation(
    ({ file, agentId }: { file: File; agentId?: string }) => uploadDocument(file, agentId),
    {
      getInvalidateQueries: (variables) => {
        const queries: QueryKey[] = [['knowledge-base', 'documents']]
        if (variables.agentId) {
          queries.push(['knowledge-base', 'documents', variables.agentId])
        }
        return queries
      },
      successMessage: 'Document uploaded successfully',
      errorMessagePrefix: 'Failed to upload document',
    }
  )
}

export function useDeleteDocument() {
  return useSimpleMutation(deleteDocument, {
    invalidateQueries: [['knowledge-base', 'documents']],
    successMessage: 'Document deleted successfully',
    errorMessagePrefix: 'Failed to delete document',
  })
}

async function searchDocuments(
  query: string,
  agentId?: string,
  topK: number = 10
): Promise<SearchResponse> {
  const response = await fetch('/api/knowledge-base/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, agentId, topK }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to search documents')
  }

  return response.json()
}

export function useSearchDocuments(query: string, agentId?: string, topK: number = 10) {
  return useQuery({
    queryKey: ['knowledge-base', 'search', query, agentId, topK],
    queryFn: () => searchDocuments(query, agentId, topK),
    enabled: query.trim().length > 0,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}


