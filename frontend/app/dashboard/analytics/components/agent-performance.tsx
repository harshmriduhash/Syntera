"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAgentAnalytics, type DateRange } from '@/lib/api/analytics'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface AgentPerformanceProps {
  dateRange?: DateRange
}

export function AgentPerformance({ dateRange }: AgentPerformanceProps) {
  const { data, isLoading, error } = useAgentAnalytics(dateRange)

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
          <CardDescription>Compare agent metrics and performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">
            Failed to load agent data. Please try again.
          </div>
        </CardContent>
      </Card>
    )
  }

  const agents = data?.agents || []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Performance</CardTitle>
        <CardDescription>Compare agent metrics and performance</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No agent data available for the selected period
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent Name</TableHead>
                <TableHead>Conversations</TableHead>
                <TableHead>Avg Response Time</TableHead>
                <TableHead>Satisfaction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.agentId}>
                  <TableCell className="font-medium">{agent.agentName}</TableCell>
                  <TableCell>{agent.conversationCount}</TableCell>
                  <TableCell>
                    {agent.avgResponseTime > 0
                      ? `${Math.round(agent.avgResponseTime / 1000)}s`
                      : 'N/A'}
                  </TableCell>
                  <TableCell>{agent.satisfaction}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

