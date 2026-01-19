/**
 * Workflow API Client
 * React Query hooks for workflow operations
 */

import { useQuery, useMutation } from '@tanstack/react-query'
import type {
  Workflow,
  WorkflowExecution,
  CreateWorkflowInput,
  UpdateWorkflowInput,
} from '@syntera/shared'
import { useSimpleMutation } from '@/hooks/use-optimistic-mutation'

// API functions
async function fetchWorkflows(): Promise<{ workflows: Workflow[] }> {
  const response = await fetch('/api/workflows')
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch workflows' }))
    throw new Error(error.error || 'Failed to fetch workflows')
  }
  return await response.json()
}

async function fetchWorkflow(id: string): Promise<{ workflow: Workflow }> {
  const response = await fetch(`/api/workflows/${id}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch workflow' }))
    throw new Error(error.error || 'Failed to fetch workflow')
  }
  return await response.json()
}

async function createWorkflow(data: CreateWorkflowInput): Promise<{ workflow: Workflow }> {
  const response = await fetch('/api/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create workflow' }))
    const errorMessage = error.error || error.message || 'Failed to create workflow'
    throw new Error(errorMessage)
  }
  return await response.json()
}

async function updateWorkflow(
  id: string,
  data: UpdateWorkflowInput
): Promise<{ workflow: Workflow }> {
  const response = await fetch(`/api/workflows/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update workflow' }))
    throw new Error(error.error || 'Failed to update workflow')
  }
  return await response.json()
}

async function deleteWorkflow(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/workflows/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to delete workflow' }))
    throw new Error(error.error || 'Failed to delete workflow')
  }
  return await response.json()
}

async function enableWorkflow(id: string): Promise<{ workflow: Workflow }> {
  const response = await fetch(`/api/workflows/${id}/enable`, {
    method: 'POST',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to enable workflow' }))
    throw new Error(error.error || 'Failed to enable workflow')
  }
  return await response.json()
}

async function disableWorkflow(id: string): Promise<{ workflow: Workflow }> {
  const response = await fetch(`/api/workflows/${id}/disable`, {
    method: 'POST',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to disable workflow' }))
    throw new Error(error.error || 'Failed to disable workflow')
  }
  return await response.json()
}

async function testWorkflow(
  id: string,
  triggerData?: Record<string, unknown>
): Promise<{ success: boolean; message: string; workflow: Workflow }> {
  const response = await fetch(`/api/workflows/${id}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(triggerData || {}),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to test workflow' }))
    throw new Error(error.error || 'Failed to test workflow')
  }
  return await response.json()
}

async function fetchWorkflowExecutions(
  id: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ executions: WorkflowExecution[]; total: number }> {
  const response = await fetch(`/api/workflows/${id}/executions?limit=${limit}&offset=${offset}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch executions' }))
    throw new Error(error.error || 'Failed to fetch executions')
  }
  return await response.json()
}

// React Query hooks
export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: fetchWorkflows,
    staleTime: 30000, // 30 seconds
  })
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ['workflows', id],
    queryFn: () => fetchWorkflow(id),
    enabled: !!id,
  })
}

export function useCreateWorkflow() {
  return useSimpleMutation(createWorkflow, {
    invalidateQueries: [['workflows']],
    successMessage: 'Workflow created successfully',
    errorMessagePrefix: 'Failed to create workflow',
  })
}

export function useUpdateWorkflow() {
  return useSimpleMutation(
    ({ id, data }: { id: string; data: UpdateWorkflowInput }) => updateWorkflow(id, data),
    {
      getInvalidateQueries: (variables) => [
        ['workflows'],
        ['workflows', variables.id],
      ],
      successMessage: 'Workflow updated successfully',
      errorMessagePrefix: 'Failed to update workflow',
    }
  )
}

export function useDeleteWorkflow() {
  return useSimpleMutation(deleteWorkflow, {
    invalidateQueries: [['workflows']],
    successMessage: 'Workflow deleted successfully',
    errorMessagePrefix: 'Failed to delete workflow',
  })
}

export function useEnableWorkflow() {
  return useSimpleMutation(enableWorkflow, {
    getInvalidateQueries: (id) => [
      ['workflows'],
      ['workflows', id],
    ],
    successMessage: 'Workflow enabled',
    errorMessagePrefix: 'Failed to enable workflow',
  })
}

export function useDisableWorkflow() {
  return useSimpleMutation(disableWorkflow, {
    getInvalidateQueries: (id) => [
      ['workflows'],
      ['workflows', id],
    ],
    successMessage: 'Workflow disabled',
    errorMessagePrefix: 'Failed to disable workflow',
  })
}

export function useTestWorkflow() {
  return useMutation({
    mutationFn: ({ id, triggerData }: { id: string; triggerData?: Record<string, unknown> }) =>
      testWorkflow(id, triggerData),
  })
}

export function useWorkflowExecutions(id: string, limit?: number, offset?: number) {
  return useQuery({
    queryKey: ['workflows', id, 'executions', limit, offset],
    queryFn: () => fetchWorkflowExecutions(id, limit, offset),
    enabled: !!id,
  })
}

