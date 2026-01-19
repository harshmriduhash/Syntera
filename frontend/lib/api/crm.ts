/**
 * CRM API Client
 * React Query hooks for CRM operations
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { useSimpleMutation } from '@/hooks/use-optimistic-mutation'

export interface Contact {
  id: string
  company_id: string
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  company_name?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  company_id: string
  contact_id?: string
  title: string
  value?: number
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost'
  probability: number
  expected_close_date?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  contacts?: Contact
}

export interface CreateContactInput {
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  company_name?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface UpdateContactInput extends Partial<CreateContactInput> {}

export interface CreateDealInput {
  contact_id?: string
  title: string
  value?: number
  stage?: Deal['stage']
  probability?: number
  expected_close_date?: string
  metadata?: Record<string, unknown>
}

export interface UpdateDealInput extends Partial<CreateDealInput> {}

// API functions
async function fetchContacts(params?: { search?: string; limit?: number; offset?: number }): Promise<{ contacts: Contact[]; total: number }> {
  const queryParams = new URLSearchParams()
  if (params?.search) queryParams.append('search', params.search)
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  if (params?.offset) queryParams.append('offset', params.offset.toString())

  const response = await fetch(`/api/crm/contacts?${queryParams.toString()}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch contacts' }))
    throw new Error(error.error || 'Failed to fetch contacts')
  }
  return await response.json()
}

async function fetchContact(id: string): Promise<{ contact: Contact }> {
  const response = await fetch(`/api/crm/contacts/${id}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch contact' }))
    throw new Error(error.error || 'Failed to fetch contact')
  }
  return await response.json()
}

async function createContact(data: CreateContactInput): Promise<{ contact: Contact }> {
  const response = await fetch('/api/crm/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create contact' }))
    throw new Error(error.error || 'Failed to create contact')
  }
  return await response.json()
}

async function updateContact(id: string, data: UpdateContactInput): Promise<{ contact: Contact }> {
  const response = await fetch(`/api/crm/contacts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update contact' }))
    throw new Error(error.error || 'Failed to update contact')
  }
  return await response.json()
}

async function deleteContact(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/crm/contacts/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to delete contact' }))
    throw new Error(error.error || 'Failed to delete contact')
  }
  return await response.json()
}

async function fetchDeals(params?: { stage?: string; contact_id?: string; limit?: number; offset?: number }): Promise<{ deals: Deal[]; total: number }> {
  const queryParams = new URLSearchParams()
  if (params?.stage) queryParams.append('stage', params.stage)
  if (params?.contact_id) queryParams.append('contact_id', params.contact_id)
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  if (params?.offset) queryParams.append('offset', params.offset.toString())

  const response = await fetch(`/api/crm/deals?${queryParams.toString()}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch deals' }))
    throw new Error(error.error || 'Failed to fetch deals')
  }
  return await response.json()
}

async function fetchDeal(id: string): Promise<{ deal: Deal }> {
  const response = await fetch(`/api/crm/deals/${id}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch deal' }))
    throw new Error(error.error || 'Failed to fetch deal')
  }
  return await response.json()
}

async function createDeal(data: CreateDealInput): Promise<{ deal: Deal }> {
  const response = await fetch('/api/crm/deals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create deal' }))
    throw new Error(error.error || 'Failed to create deal')
  }
  return await response.json()
}

async function updateDeal(id: string, data: UpdateDealInput): Promise<{ deal: Deal }> {
  const response = await fetch(`/api/crm/deals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update deal' }))
    throw new Error(error.error || 'Failed to update deal')
  }
  return await response.json()
}

async function deleteDeal(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/crm/deals/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to delete deal' }))
    throw new Error(error.error || 'Failed to delete deal')
  }
  return await response.json()
}

// React Query hooks
export function useContacts(params?: { search?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['crm', 'contacts', params],
    queryFn: () => fetchContacts(params),
    staleTime: 30000, // 30 seconds
  })
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ['crm', 'contacts', id],
    queryFn: () => fetchContact(id),
    enabled: !!id,
  })
}

export function useCreateContact() {
  return useSimpleMutation(createContact, {
    invalidateQueries: [['crm', 'contacts']],
    successMessage: 'Contact created successfully',
    errorMessagePrefix: 'Failed to create contact',
  })
}

export function useUpdateContact() {
  return useSimpleMutation(
    ({ id, data }: { id: string; data: UpdateContactInput }) => updateContact(id, data),
    {
      getInvalidateQueries: (variables) => [
        ['crm', 'contacts'],
        ['crm', 'contacts', variables.id],
      ],
      successMessage: 'Contact updated successfully',
      errorMessagePrefix: 'Failed to update contact',
    }
  )
}

export function useDeleteContact() {
  return useSimpleMutation(deleteContact, {
    invalidateQueries: [['crm', 'contacts']],
    successMessage: 'Contact deleted successfully',
    errorMessagePrefix: 'Failed to delete contact',
  })
}

export function useDeals(params?: { stage?: string; contact_id?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['crm', 'deals', params],
    queryFn: () => fetchDeals(params),
    staleTime: 30000, // 30 seconds
  })
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: ['crm', 'deals', id],
    queryFn: () => fetchDeal(id),
    enabled: !!id,
  })
}

export function useCreateDeal() {
  return useSimpleMutation(createDeal, {
    invalidateQueries: [['crm', 'deals']],
    successMessage: 'Deal created successfully',
    errorMessagePrefix: 'Failed to create deal',
  })
}

export function useUpdateDeal() {
  return useSimpleMutation(
    ({ id, data }: { id: string; data: UpdateDealInput }) => updateDeal(id, data),
    {
      getInvalidateQueries: (variables) => [
        ['crm', 'deals'],
        ['crm', 'deals', variables.id],
      ],
      successMessage: 'Deal updated successfully',
      errorMessagePrefix: 'Failed to update deal',
    }
  )
}

export function useDeleteDeal() {
  return useSimpleMutation(deleteDeal, {
    invalidateQueries: [['crm', 'deals']],
    successMessage: 'Deal deleted successfully',
    errorMessagePrefix: 'Failed to delete deal',
  })
}

