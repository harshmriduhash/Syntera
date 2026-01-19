"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useOverviewMetrics, type DateRange } from '@/lib/api/analytics'
import { MessageSquare, Users, Bot, Clock, Heart } from 'lucide-react'

interface OverviewMetricsProps {
  dateRange?: DateRange
}

export function OverviewMetrics({ dateRange }: OverviewMetricsProps) {
  const { data, isLoading, error } = useOverviewMetrics(dateRange)

  if (error) {
    return (
      <div className="text-sm text-destructive">
        Failed to load metrics. Please try again.
      </div>
    )
  }

  const metrics = [
    {
      label: 'Total Conversations',
      value: data?.totalConversations ?? 0,
      icon: MessageSquare,
      color: 'text-blue-600',
    },
    {
      label: 'Active Conversations',
      value: data?.activeConversations ?? 0,
      icon: MessageSquare,
      color: 'text-green-600',
    },
    {
      label: 'Active Agents',
      value: data?.activeAgents ?? 0,
      icon: Bot,
      color: 'text-purple-600',
    },
    {
      label: 'Avg Response Time',
      value: data?.avgResponseTime
        ? `${Math.round(data.avgResponseTime / 1000)}s`
        : '0s',
      icon: Clock,
      color: 'text-orange-600',
    },
    {
      label: 'User Satisfaction',
      value: data?.userSatisfaction
        ? `${data.userSatisfaction}%`
        : '0%',
      icon: Heart,
      color: 'text-red-600',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {metrics.map((metric) => {
        const Icon = metric.icon
        return (
          <Card key={metric.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.label}
              </CardTitle>
              <Icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{metric.value}</div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

