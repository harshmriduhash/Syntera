"use client"

import { useCreateWorkflow } from '@/lib/api/workflows'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import type { Workflow } from '@syntera/shared'

// Lazy load WorkflowBuilder (contains ReactFlow - ~100KB)
const WorkflowBuilder = dynamic(
  () => import('@/components/workflows/workflow-builder').then((mod) => mod.WorkflowBuilder),
  {
    ssr: false,
    loading: () => <LoadingSkeleton />,
  }
)

export default function NewWorkflowPage() {
  const router = useRouter()
  const createWorkflow = useCreateWorkflow()

  const newWorkflow: Workflow = {
    id: 'new',
    company_id: '',
    name: 'New Workflow',
    description: '',
    enabled: true,
    trigger_type: 'purchase_intent',
    trigger_config: {},
    nodes: [],
    edges: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const handleSave = async (workflowData: {
    name?: string
    description?: string
    trigger_type?: string
    trigger_config?: Record<string, unknown>
    nodes?: any[]
    edges?: any[]
  }) => {
    try {
      const result = await createWorkflow.mutateAsync({
        name: workflowData.name || 'New Workflow',
        description: workflowData.description,
        enabled: true,
        trigger_type: (workflowData.trigger_type || 'purchase_intent') as any,
        trigger_config: workflowData.trigger_config || {},
        nodes: workflowData.nodes || [],
        edges: workflowData.edges || [],
      })
      if (result?.workflow?.id) {
        router.push(`/dashboard/workflows/${result.workflow.id}`)
      }
    } catch (error) {
      // Error handled by mutation
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <WorkflowBuilder
        workflow={newWorkflow}
        onSave={handleSave}
        onCancel={() => router.push('/dashboard/workflows')}
        isNew={true}
      />
    </div>
  )
}

