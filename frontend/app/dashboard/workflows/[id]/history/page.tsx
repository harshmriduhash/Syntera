"use client"

import { useWorkflowExecutions } from '@/lib/api/workflows'
import { useParams } from 'next/navigation'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

const STATUS_COLORS = {
  success: 'bg-green-500/10 text-green-700 dark:text-green-400',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-400',
  running: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  cancelled: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
}

const STATUS_ICONS = {
  success: CheckCircle2,
  failed: XCircle,
  running: Clock,
  cancelled: AlertCircle,
}

export default function WorkflowHistoryPage() {
  const params = useParams()
  const workflowId = params.id as string
  const { data, isLoading, error } = useWorkflowExecutions(workflowId, 50, 0)

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load execution history. Please try again.</p>
            <Button asChild className="mt-4">
              <Link href={`/dashboard/workflows/${workflowId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Workflow
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const executions = data?.executions || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflow Execution History</h1>
          <p className="text-muted-foreground mt-1">
            View execution logs and results for this workflow
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/dashboard/workflows/${workflowId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workflow
          </Link>
        </Button>
      </div>

      {executions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground">No executions yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                This workflow hasn't been executed yet. It will run automatically when triggered.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {executions.map((execution) => {
            const StatusIcon = STATUS_ICONS[execution.status] || AlertCircle
            const statusColor = STATUS_COLORS[execution.status] || STATUS_COLORS.cancelled

            return (
              <Card key={execution.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`h-5 w-5 ${statusColor}`} />
                      <div>
                        <CardTitle className="text-lg">
                          {format(new Date(execution.executed_at), 'MMM d, yyyy HH:mm:ss')}
                        </CardTitle>
                        <CardDescription>
                          Triggered by: {execution.triggered_by}
                          {execution.triggered_by_id && ` (${execution.triggered_by_id})`}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={statusColor}>{execution.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {execution.execution_time_ms && (
                      <div className="text-sm text-muted-foreground">
                        Execution time: {execution.execution_time_ms}ms
                      </div>
                    )}

                    {execution.error_message && (
                      <div className="rounded-md bg-red-500/10 p-3">
                        <p className="text-sm font-medium text-red-700 dark:text-red-400">
                          Error: {execution.error_message}
                        </p>
                        {execution.error_stack && (
                          <pre className="mt-2 text-xs text-red-600 dark:text-red-300 overflow-auto">
                            {execution.error_stack}
                          </pre>
                        )}
                      </div>
                    )}

                    {execution.trigger_data && Object.keys(execution.trigger_data).length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Trigger Data:</p>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                          {JSON.stringify(execution.trigger_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {execution.execution_data && Object.keys(execution.execution_data).length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Execution Data:</p>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                          {JSON.stringify(execution.execution_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {data && data.total > executions.length && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              Showing {executions.length} of {data.total} executions
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}





