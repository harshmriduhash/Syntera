"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker, type DateRange } from './components/date-range-picker'
import { OverviewMetrics } from './components/overview-metrics'
import { ConversationChart } from './components/conversation-chart'
import { ChannelDistribution } from './components/channel-distribution'
import { AgentPerformance } from './components/agent-performance'
import { CostAnalysis } from './components/cost-analysis'
import { CRMInsights } from './components/crm-insights'
import { BarChart3 } from 'lucide-react'

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Track performance metrics and insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* Date Range Picker */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
          <CardDescription>Select the time period for analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </CardContent>
      </Card>

      {/* Overview Metrics */}
      <OverviewMetrics dateRange={dateRange} />

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <ConversationChart dateRange={dateRange} />
        <ChannelDistribution dateRange={dateRange} />
      </div>

      {/* Agent Performance */}
      <AgentPerformance dateRange={dateRange} />

      {/* Cost and CRM */}
      <div className="grid gap-4 md:grid-cols-2">
        <CostAnalysis dateRange={dateRange} />
        <CRMInsights dateRange={dateRange} />
      </div>
    </div>
  )
}
