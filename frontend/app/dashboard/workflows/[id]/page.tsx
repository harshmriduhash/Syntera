"use client"

import { useWorkflow, useUpdateWorkflow } from '@/lib/api/workflows'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// Lazy load WorkflowBuilder (contains ReactFlow - ~100KB)
const WorkflowBuilder = dynamic(
  () => import('@/components/workflows/workflow-builder').then((mod) => mod.WorkflowBuilder),
  {
    ssr: false,
    loading: () => <LoadingSkeleton />,
  }
)

export default function WorkflowBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const workflowId = params.id as string
  const { data, isLoading, error } = useWorkflow(workflowId)
  const updateWorkflow = useUpdateWorkflow()

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error || !data?.workflow) {
    return (
      <div className="space-y-6">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load workflow. Please try again.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/workflows">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Workflows
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSave = async (workflowData: {
    name?: string
    description?: string
    nodes?: any[]
    edges?: any[]
    trigger_config?: Record<string, unknown>
  }) => {
    try {
      await updateWorkflow.mutateAsync({
        id: workflowId,
        data: {
          name: workflowData.name,
          description: workflowData.description,
          nodes: workflowData.nodes,
          edges: workflowData.edges,
          trigger_config: workflowData.trigger_config,
        },
      })
    } catch (error) {
      // Error handled by mutation
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <WorkflowBuilder
        workflow={data.workflow}
        onSave={handleSave}
        onCancel={() => router.push('/dashboard/workflows')}
      />
    </div>
  )
}

