"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCRMAnalytics, type DateRange } from '@/lib/api/analytics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface CRMInsightsProps {
  dateRange?: DateRange
}

export function CRMInsights({ dateRange }: CRMInsightsProps) {
  const { data, isLoading, error } = useCRMAnalytics(dateRange)

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CRM Insights</CardTitle>
          <CardDescription>Contact-to-deal conversion and pipeline value</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">
            Failed to load CRM data. Please try again.
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = data?.dealsByStage.map((item) => ({
    stage: item.stage.charAt(0).toUpperCase() + item.stage.slice(1).replace('-', ' '),
    count: item.count,
    value: item.value,
  })) || []

  return (
    <Card>
      <CardHeader>
        <CardTitle>CRM Insights</CardTitle>
        <CardDescription>
          Contact-to-deal conversion: {data?.contactToDealConversion || 0}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No CRM data available for the selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Deals" />
              <Bar yAxisId="right" dataKey="value" fill="#82ca9d" name="Value ($)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

