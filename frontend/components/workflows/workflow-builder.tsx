"use client"

import { useEffect, useCallback, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useWorkflowStore } from '@/lib/store/workflow-store'
import { NodePalette } from './node-palette'
import { ConfigurationPanel } from './configuration-panel'
import { WorkflowToolbar } from './workflow-toolbar'
import { TriggerNode } from './nodes/trigger-node'
import { ConditionNode } from './nodes/condition-node'
import { ActionNode } from './nodes/action-node'
import type { Workflow, WorkflowNode, WorkflowEdge } from '@syntera/shared'

// Define nodeTypes outside component to avoid React Flow warning
// Must be stable reference - don't recreate on each render
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
}

interface WorkflowBuilderProps {
  workflow: Workflow
  onSave: (data: {
    name?: string
    description?: string
    enabled?: boolean
    trigger_type?: string
    trigger_config?: Record<string, unknown>
    nodes?: any[]
    edges?: any[]
  }) => Promise<void>
  onCancel: () => void
  isNew?: boolean
}

function WorkflowBuilderInner({
  workflow,
  onSave,
  onCancel,
  isNew = false,
}: WorkflowBuilderProps) {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    setNodes,
    setEdges,
    selectedNode,
    setSelectedNode,
  } = useWorkflowStore()

  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodesState, onNodesChange] = useNodesState([])
  const [edges, setEdgesState, onEdgesChange] = useEdgesState([])
  const isInitialMountRef = useRef(true)
  const skipSyncRef = useRef(false)

  // Initialize from workflow
  useEffect(() => {
    if (workflow.nodes && workflow.edges) {
      // Convert WorkflowNode[] to Node[] for React Flow
      const initialNodes = workflow.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position || { x: 0, y: 0 },
        data: {
          ...node.data,
          label: node.data?.label || node.nodeType || node.id,
          nodeType: node.nodeType,
          config: node.data?.config || {},
        },
      })) as Node[]
      // Convert WorkflowEdge[] to Edge[] for React Flow
      const initialEdges = workflow.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: edge.type,
      })) as Edge[]

      // Store expects WorkflowNode[] and WorkflowEdge[] (use original workflow data)
      setNodes(workflow.nodes)
      setEdges(workflow.edges)
      // React Flow state expects Node[] and Edge[]
      setNodesState(initialNodes)
      setEdgesState(initialEdges)
    } else {
      // Initialize with empty arrays if no nodes/edges
      setNodes([])
      setEdges([])
      setNodesState([])
      setEdgesState([])
    }
  }, [workflow.id, setNodes, setEdges, setNodesState, setEdgesState])

  // Sync store with React Flow state when React Flow state changes (but not on initial load)
  useEffect(() => {
    if (isInitialMountRef.current || skipSyncRef.current) {
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false
      }
      return
    }
    const mappedNodes: WorkflowNode[] = nodes.map((n) => ({
      id: n.id,
      type: n.type as WorkflowNode['type'],
      nodeType: (n.data as any)?.nodeType || n.type,
      position: n.position,
      data: n.data,
    }))
    skipSyncRef.current = true
    setNodes(mappedNodes)
    setTimeout(() => { skipSyncRef.current = false }, 0)
  }, [nodes, setNodes])

  useEffect(() => {
    if (isInitialMountRef.current || skipSyncRef.current) return
    const mappedEdges: WorkflowEdge[] = edges.map((e) => ({
      id: e.id || `edge-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type,
    }))
    skipSyncRef.current = true
    setEdges(mappedEdges)
    setTimeout(() => { skipSyncRef.current = false }, 0)
  }, [edges, setEdges])

  // Sync React Flow state when store updates (from configuration panel)
  useEffect(() => {
    if (skipSyncRef.current) return
    const mappedNodes = storeNodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })) as Node[]
    setNodesState(mappedNodes)
  }, [storeNodes, setNodesState])

  useEffect(() => {
    if (skipSyncRef.current) return
    const mappedEdges = storeEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type || 'smoothstep',
    })) as Edge[]
    setEdgesState(mappedEdges)
  }, [storeEdges, setEdgesState])

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) {
        return
      }
      const newEdge = {
        ...params,
        id: `edge-${params.source}-${params.target}-${Date.now()}`,
        type: 'smoothstep' as const,
      }
      setEdgesState((eds) => addEdge(newEdge, eds))
    },
    [setEdgesState]
  )

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id)
    },
    [setSelectedNode]
  )

  const handleSave = useCallback(async (name?: string, description?: string) => {
    try {
      const workflowData = {
        name: name || workflow.name || 'New Workflow',
        description: description || workflow.description || '',
        enabled: workflow.enabled ?? true,
        trigger_type: workflow.trigger_type || 'purchase_intent',
        trigger_config: workflow.trigger_config || {},
        nodes: nodes.map((node) => {
          const nodeData = node.data as any
          const nodeType = nodeData?.nodeType || node.type
          return {
            id: node.id,
            type: node.type as 'trigger' | 'condition' | 'action' | 'logic',
            nodeType: nodeType, // Required by validation schema
            position: node.position || { x: 0, y: 0 },
            data: {
              label: nodeData?.label || nodeType || node.id,
              config: nodeData?.config || {},
              nodeType: nodeType,
            },
          }
        }),
        edges: edges.map((edge) => {
          const edgeData: any = {
            id: edge.id || `edge-${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
          }
          if (edge.sourceHandle) edgeData.sourceHandle = edge.sourceHandle
          if (edge.targetHandle) edgeData.targetHandle = edge.targetHandle
          if (edge.type) edgeData.type = edge.type
          return edgeData
        }),
      }
      
      await onSave(workflowData)
    } catch (error) {
      throw error
    }
  }, [nodes, edges, onSave, workflow])

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      try {
        const data = JSON.parse(event.dataTransfer.getData('application/reactflow'))
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })

        const newNode = {
          id: `${data.type}-${Date.now()}`,
          type: data.type,
          nodeType: data.nodeType,
          position,
          data: {
            label: data.nodeType,
            nodeType: data.nodeType,
            config: {},
          },
        }

        setNodesState((nds) => nds.concat(newNode as Node))
      } catch (error) {
        // Silently handle drag data parse errors
      }
    },
    [screenToFlowPosition, setNodesState]
  )

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div className="flex h-full relative">
      {/* Node Palette */}
      <NodePalette />

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        <WorkflowToolbar
          workflow={workflow}
          onSave={async (data) => {
            await handleSave(data.name, data.description)
          }}
          onCancel={onCancel}
          isNew={isNew}
        />
        <div className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-muted/20"
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* Configuration Panel - Overlay */}
      {selectedNode && (
        <div className="absolute right-0 top-0 bottom-0 z-50">
          <ConfigurationPanel
            nodeId={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        </div>
      )}
    </div>
  )
}

export function WorkflowBuilder(props: WorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner {...props} />
    </ReactFlowProvider>
  )
}

