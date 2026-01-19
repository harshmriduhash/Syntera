/**
 * Analytics API Client
 * Functions for fetching analytics data
 */

import { useQuery } from '@tanstack/react-query'

export interface OverviewMetrics {
  totalConversations: number
  activeConversations: number
  activeAgents: number
  avgResponseTime: number
  userSatisfaction: number
}

export interface ConversationAnalytics {
  timeline: Array<{ date: string; count: number }>
  byChannel: Array<{ channel: string; count: number }>
  avgDuration: number
}

export interface AgentPerformance {
  agentId: string
  agentName: string
  conversationCount: number
  avgResponseTime: number
  satisfaction: number
}

export interface CostMetrics {
  totalTokens: number
  estimatedCost: number
}

export interface CRMAnalytics {
  contactToDealConversion: number
  dealsByStage: Array<{ stage: string; count: number; value: number }>
}

export interface DateRange {
  startDate: string
  endDate: string
}

interface AnalyticsParams {
  startDate?: string
  endDate?: string
  groupBy?: 'day' | 'week' | 'month'
}

async function fetchOverview(params?: AnalyticsParams): Promise<OverviewMetrics> {
  const searchParams = new URLSearchParams()
  if (params?.startDate) searchParams.append('startDate', params.startDate)
  if (params?.endDate) searchParams.append('endDate', params.endDate)

  const response = await fetch(`/api/analytics/overview?${searchParams.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch overview metrics')
  }
  return response.json()
}

async function fetchConversations(params?: AnalyticsParams): Promise<ConversationAnalytics> {
  const searchParams = new URLSearchParams()
  if (params?.startDate) searchParams.append('startDate', params.startDate)
  if (params?.endDate) searchParams.append('endDate', params.endDate)
  if (params?.groupBy) searchParams.append('groupBy', params.groupBy)

  const response = await fetch(`/api/analytics/conversations?${searchParams.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch conversation analytics')
  }
  return response.json()
}

async function fetchAgents(params?: AnalyticsParams): Promise<{ agents: AgentPerformance[] }> {
  const searchParams = new URLSearchParams()
  if (params?.startDate) searchParams.append('startDate', params.startDate)
  if (params?.endDate) searchParams.append('endDate', params.endDate)

  const response = await fetch(`/api/analytics/agents?${searchParams.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch agent analytics')
  }
  return response.json()
}

async function fetchCosts(params?: AnalyticsParams): Promise<CostMetrics> {
  const searchParams = new URLSearchParams()
  if (params?.startDate) searchParams.append('startDate', params.startDate)
  if (params?.endDate) searchParams.append('endDate', params.endDate)

  const response = await fetch(`/api/analytics/costs?${searchParams.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch cost analytics')
  }
  return response.json()
}

async function fetchCRM(params?: AnalyticsParams): Promise<CRMAnalytics> {
  const searchParams = new URLSearchParams()
  if (params?.startDate) searchParams.append('startDate', params.startDate)
  if (params?.endDate) searchParams.append('endDate', params.endDate)

  const response = await fetch(`/api/analytics/crm?${searchParams.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch CRM analytics')
  }
  return response.json()
}

// React Query hooks
export function useOverviewMetrics(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ['analytics', 'overview', params],
    queryFn: () => fetchOverview(params),
    staleTime: 300000, // 5 minutes
  })
}

export function useConversationAnalytics(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ['analytics', 'conversations', params],
    queryFn: () => fetchConversations(params),
    staleTime: 300000,
  })
}

export function useAgentAnalytics(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ['analytics', 'agents', params],
    queryFn: () => fetchAgents(params),
    staleTime: 300000,
  })
}

export function useCostAnalytics(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ['analytics', 'costs', params],
    queryFn: () => fetchCosts(params),
    staleTime: 300000,
  })
}

export function useCRMAnalytics(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ['analytics', 'crm', params],
    queryFn: () => fetchCRM(params),
    staleTime: 300000,
  })
}

