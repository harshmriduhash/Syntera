/**
 * Notifications API Client
 * React Query hooks for notification operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Notification {
  id: string
  user_id: string
  company_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'workflow'
  read: boolean
  read_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// API functions
async function fetchNotifications(params?: { unread?: boolean; limit?: number; offset?: number }): Promise<{ notifications: Notification[]; total: number }> {
  const searchParams = new URLSearchParams()
  if (params?.unread) searchParams.set('unread', 'true')
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.offset) searchParams.set('offset', params.offset.toString())

  const response = await fetch(`/api/notifications?${searchParams.toString()}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch notifications' }))
    throw new Error(error.error || 'Failed to fetch notifications')
  }
  return await response.json()
}

async function fetchUnreadCount(): Promise<{ count: number }> {
  const response = await fetch('/api/notifications/unread-count')
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch unread count' }))
    throw new Error(error.error || 'Failed to fetch unread count')
  }
  return await response.json()
}

async function markAsRead(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/notifications/${id}/read`, {
    method: 'PATCH',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to mark notification as read' }))
    throw new Error(error.error || 'Failed to mark notification as read')
  }
  return await response.json()
}

async function markAllAsRead(): Promise<{ success: boolean }> {
  const response = await fetch('/api/notifications/read-all', {
    method: 'PATCH',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to mark all as read' }))
    throw new Error(error.error || 'Failed to mark all as read')
  }
  return await response.json()
}

// React Query hooks
export function useNotifications(params?: { unread?: boolean; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => fetchNotifications(params),
    staleTime: 30000, // 30 seconds
  })
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}










