"use client"

import { useWorkflows, useEnableWorkflow, useDisableWorkflow } from '@/lib/api/workflows'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Workflow, Plus, Settings, History } from 'lucide-react'
import Link from 'next/link'
import { LazyMotionDiv } from '@/components/shared/lazy-motion'
import { Switch } from '@/components/ui/switch'
import { format } from 'date-fns'

const TRIGGER_LABELS: Record<string, string> = {
  purchase_intent: 'Purchase Intent Detected',
  conversation_started: 'Conversation Started',
  conversation_ended: 'Conversation Ended',
  contact_created: 'Contact Created',
  contact_updated: 'Contact Updated',
  deal_created: 'Deal Created',
  deal_stage_changed: 'Deal Stage Changed',
  message_received: 'Message Received',
  webhook: 'Webhook',
}

export default function WorkflowsPage() {
  const { data, isLoading, error } = useWorkflows()
  const enableWorkflow = useEnableWorkflow()
  const disableWorkflow = useDisableWorkflow()

  const workflows = data?.workflows || []

  const handleToggleWorkflow = async (workflow: typeof workflows[0]) => {
    if (workflow.enabled) {
      await disableWorkflow.mutateAsync(workflow.id)
    } else {
      await enableWorkflow.mutateAsync(workflow.id)
    }
  }

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load workflows. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <LazyMotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground text-lg">
            Automate your business processes with visual workflows
          </p>
        </div>
        <LazyMotionDiv
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button asChild>
            <Link href="/dashboard/workflows/new">
              <Plus className="mr-2 h-4 w-4" />
              New Workflow
            </Link>
          </Button>
        </LazyMotionDiv>
      </LazyMotionDiv>

      {/* Workflows List */}
      {workflows.length === 0 ? (
        <LazyMotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <EmptyState
            icon={Workflow}
            title="No workflows found"
            description="Get started by creating your first workflow"
            action={
              <Button asChild>
                <Link href="/dashboard/workflows/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Workflow
                </Link>
              </Button>
            }
          />
        </LazyMotionDiv>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow, index) => (
            <LazyMotionDiv
              key={workflow.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.05 }}
            >
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {workflow.description || 'No description'}
                      </CardDescription>
                    </div>
                    <Badge variant={workflow.enabled ? 'default' : 'secondary'}>
                      {workflow.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Workflow className="h-4 w-4" />
                    <span>Trigger: {TRIGGER_LABELS[workflow.trigger_type] || workflow.trigger_type}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={workflow.enabled}
                        onCheckedChange={() => handleToggleWorkflow(workflow)}
                        disabled={enableWorkflow.isPending || disableWorkflow.isPending}
                      />
                      <span className="text-sm text-muted-foreground">
                        {workflow.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/dashboard/workflows/${workflow.id}`}>
                          <Settings className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/dashboard/workflows/${workflow.id}/history`}>
                          <History className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Updated {format(new Date(workflow.updated_at), 'MMM d, yyyy')}
                  </div>
                </CardContent>
              </Card>
            </LazyMotionDiv>
          ))}
        </div>
      )}
    </div>
  )
}



