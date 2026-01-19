"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useConversationAnalytics, type DateRange } from '@/lib/api/analytics'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface ChannelDistributionProps {
  dateRange?: DateRange
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00']

export function ChannelDistribution({ dateRange }: ChannelDistributionProps) {
  const { data, isLoading, error } = useConversationAnalytics(dateRange)

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversations by Channel</CardTitle>
          <CardDescription>Distribution across communication channels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">
            Failed to load chart data. Please try again.
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = data?.byChannel.map((item) => ({
    name: item.channel.charAt(0).toUpperCase() + item.channel.slice(1),
    value: item.count,
  })) || []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversations by Channel</CardTitle>
        <CardDescription>Distribution across communication channels</CardDescription>
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
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

