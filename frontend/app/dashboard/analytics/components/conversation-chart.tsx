"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useConversationAnalytics, type DateRange } from '@/lib/api/analytics'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

interface ConversationChartProps {
  dateRange?: DateRange
}

export function ConversationChart({ dateRange }: ConversationChartProps) {
  const { data, isLoading, error } = useConversationAnalytics(dateRange)

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversations Over Time</CardTitle>
          <CardDescription>Track conversation volume trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">
            Failed to load chart data. Please try again.
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = data?.timeline.map((item) => ({
    date: format(new Date(item.date), 'MMM dd'),
    count: item.count,
  })) || []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversations Over Time</CardTitle>
        <CardDescription>Track conversation volume trends</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No data available for the selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

