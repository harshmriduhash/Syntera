/**
 * Agent API Client
 * React Query hooks for agent operations
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { useOptimisticMutation, type OptimisticUpdateContext } from '@/hooks/use-optimistic-mutation'
import type { AgentResponse, CreateAgentInput, UpdateAgentInput } from '@syntera/shared/client'

// Re-export types from shared package
export type Agent = AgentResponse
export type { CreateAgentInput, UpdateAgentInput }

// API functions
async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch('/api/agents')
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch agents' }))
    throw new Error(error.error || 'Failed to fetch agents')
  }
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

async function fetchAgent(id: string): Promise<Agent> {
  const response = await fetch(`/api/agents/${id}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch agent' }))
    throw new Error(error.error || 'Failed to fetch agent')
  }
  return await response.json()
}

async function createAgent(input: CreateAgentInput): Promise<Agent> {
  const response = await fetch('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create agent' }))
    throw new Error(error.error || 'Failed to create agent')
  }
  return await response.json()
}

async function updateAgent(id: string, input: UpdateAgentInput): Promise<Agent> {
  const response = await fetch(`/api/agents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update agent' }))
    throw new Error(error.error || 'Failed to update agent')
  }
  return await response.json()
}

async function deleteAgent(id: string): Promise<void> {
  const response = await fetch(`/api/agents/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete agent')
  }
}

// React Query hooks
export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  })
}

// UUID validation regex
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return uuidRegex.test(id)
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => fetchAgent(id),
    enabled: !!id && isValidUUID(id),
    retry: false, // Don't retry invalid UUIDs
  })
}

export function useCreateAgent() {
  return useOptimisticMutation(createAgent, {
    listQueryKey: ['agents'],
    successMessage: 'Agent created successfully',
    errorMessagePrefix: 'Failed to create agent',
    createOptimisticData: (newAgent) => ({
      id: `temp-${Date.now()}`,
      company_id: '',
      name: newAgent.name,
      description: newAgent.description || null,
      system_prompt: newAgent.system_prompt,
      model: newAgent.model || 'gpt-4-turbo',
      temperature: newAgent.temperature || 0.7,
      max_tokens: newAgent.max_tokens || 2000,
      enabled: newAgent.enabled ?? true,
      voice_settings: newAgent.voice_settings || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  })
}

export function useUpdateAgent() {
  return useOptimisticMutation(
    ({ id, data }: { id: string; data: UpdateAgentInput }) => updateAgent(id, data),
    {
      listQueryKey: ['agents'],
      getItemId: (vars) => vars.id,
      getItemQueryKey: (vars) => ['agents', vars.id],
      successMessage: 'Agent updated successfully',
      errorMessagePrefix: 'Failed to update agent',
      optimisticUpdateList: (old, { id, data }) =>
        old?.map((agent) =>
          agent.id === id
            ? { ...agent, ...data, updated_at: new Date().toISOString() }
            : agent
        ) || [],
      optimisticUpdateItem: (old, { data }) => {
        if (!old) return undefined
        return { ...old, ...data, updated_at: new Date().toISOString() }
      },
    }
  )
}

export function useDeleteAgent() {
  return useOptimisticMutation<void, Error, string, OptimisticUpdateContext<void, string>, Agent>(
    (id: string) => deleteAgent(id),
    {
      listQueryKey: ['agents'],
      getItemQueryKey: (id) => ['agents', id],
      successMessage: 'Agent deleted successfully',
      errorMessagePrefix: 'Failed to delete agent',
      optimisticUpdateList: (old, id: string) => old?.filter((agent) => agent.id !== id) || [],
      getCancelQueries: (id) => [['agents'], ['agents', id]],
      removeItemQueryOnSuccess: true,
    }
  )
}

