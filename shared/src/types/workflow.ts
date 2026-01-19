/**
 * Workflow System Types
 * Defines types for the n8n-style visual workflow builder
 */

export type TriggerType =
  | 'purchase_intent'
  | 'conversation_started'
  | 'conversation_ended'
  | 'contact_created'
  | 'contact_updated'
  | 'deal_created'
  | 'deal_stage_changed'
  | 'message_received'
  | 'webhook'

export type NodeType = 'trigger' | 'condition' | 'action' | 'logic'

export type ActionType =
  | 'create_deal'
  | 'update_contact'
  | 'update_deal'
  | 'add_tag'
  | 'send_notification'
  | 'send_webhook'
  | 'update_conversation_metadata'

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'exists'
  | 'not_exists'

export type ExecutionStatus = 'success' | 'failed' | 'running' | 'cancelled'

/**
 * Workflow Node
 * Represents a single node in the workflow graph
 */
export interface WorkflowNode {
  id: string
  type: NodeType
  nodeType: TriggerType | ActionType | 'if' | 'switch' | 'and' | 'or'
  position: {
    x: number
    y: number
  }
  data: {
    label: string
    config: Record<string, unknown>
    [key: string]: unknown
  }
}

/**
 * Workflow Edge
 * Represents a connection between nodes
 */
export interface WorkflowEdge {
  id: string
  source: string // Source node ID
  target: string // Target node ID
  sourceHandle?: string // Output handle (e.g., 'yes', 'no', 'default')
  targetHandle?: string // Input handle
  type?: string // Edge type (e.g., 'smoothstep', 'straight')
}

/**
 * Workflow
 * Complete workflow definition
 */
export interface Workflow {
  id: string
  company_id: string
  name: string
  description?: string
  enabled: boolean
  trigger_type: TriggerType
  trigger_config: Record<string, unknown>
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  created_at: string
  updated_at: string
}

/**
 * Workflow Execution
 * Record of a workflow execution
 */
export interface WorkflowExecution {
  id: string
  workflow_id: string
  status: ExecutionStatus
  triggered_by: string // e.g., 'conversation_id', 'contact_id'
  triggered_by_id?: string
  trigger_data: Record<string, unknown>
  execution_data: Record<string, unknown>
  error_message?: string
  error_stack?: string
  execution_time_ms?: number
  executed_at: string
}

/**
 * Condition Definition
 * Used in IF and Switch nodes
 */
export interface WorkflowCondition {
  field: string // e.g., 'contact.email', 'deal.value'
  operator: ConditionOperator
  value: unknown
}

/**
 * Action Configuration
 * Configuration for action nodes
 */
export interface CreateDealAction {
  type: 'create_deal'
  title: string // Can contain variables like {{contact.name}}
  value?: number
  stage?: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost'
  probability?: number
  expected_close_date?: string
  contact_id?: string // 'auto' or specific contact ID
  metadata?: Record<string, unknown>
}

export interface UpdateContactAction {
  type: 'update_contact'
  contact_id: string // 'auto' or specific contact ID
  fields?: Record<string, unknown>
  add_tags?: string[]
  remove_tags?: string[]
  metadata?: Record<string, unknown>
}

export interface UpdateDealAction {
  type: 'update_deal'
  deal_id: string // 'auto' or specific deal ID
  fields?: {
    title?: string
    value?: number
    stage?: string
    probability?: number
    expected_close_date?: string
  }
  metadata?: Record<string, unknown>
}

export interface AddTagAction {
  type: 'add_tag'
  contact_id: string // 'auto' or specific contact ID
  tags: string[]
}

export interface SendNotificationAction {
  type: 'send_notification'
  to: string // User ID or email
  title: string
  message: string
  notification_type?: 'in_app' | 'email'
}

export interface SendWebhookAction {
  type: 'send_webhook'
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
}

export interface UpdateConversationMetadataAction {
  type: 'update_conversation_metadata'
  conversation_id: string // 'auto' or specific conversation ID
  metadata: Record<string, unknown>
}

export type WorkflowAction =
  | CreateDealAction
  | UpdateContactAction
  | UpdateDealAction
  | AddTagAction
  | SendNotificationAction
  | SendWebhookAction
  | UpdateConversationMetadataAction

/**
 * Trigger Configuration
 */
export interface PurchaseIntentTriggerConfig {
  intent_type?: string // 'purchase' or specific intent
  confidence_threshold?: number // 0-1
  agent_id?: string // Optional: specific agent
}

export interface ConversationStartedTriggerConfig {
  agent_id?: string // Optional: specific agent
  channel?: 'chat' | 'voice' | 'email'
}

export interface ContactCreatedTriggerConfig {
  source?: string // 'widget', 'voice', 'manual', etc.
}

export interface DealStageChangedTriggerConfig {
  from_stage?: string
  to_stage?: string
  deal_id?: string
}

export interface MessageReceivedTriggerConfig {
  keywords?: string[] // Trigger if message contains keywords
  agent_id?: string
}

export type WorkflowTriggerConfig =
  | PurchaseIntentTriggerConfig
  | ConversationStartedTriggerConfig
  | ContactCreatedTriggerConfig
  | DealStageChangedTriggerConfig
  | MessageReceivedTriggerConfig

/**
 * Node Execution Context
 * Data available to nodes during execution
 */
export interface NodeExecutionContext {
  workflow: Workflow
  triggerData: Record<string, unknown>
  previousNodeOutputs: Record<string, unknown>
  conversationId?: string
  contactId?: string
  dealId?: string
  messageId?: string
  agentId?: string
  companyId: string
}

/**
 * Node Execution Result
 * Result of executing a node
 */
export interface NodeExecutionResult {
  success: boolean
  output?: Record<string, unknown>
  error?: string
  nextNodes?: string[] // Node IDs to execute next
}

/**
 * Create Workflow Input
 */
export interface CreateWorkflowInput {
  name: string
  description?: string
  enabled?: boolean
  trigger_type: TriggerType
  trigger_config: Record<string, unknown>
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

/**
 * Update Workflow Input
 */
export interface UpdateWorkflowInput {
  name?: string
  description?: string
  enabled?: boolean
  trigger_type?: TriggerType
  trigger_config?: Record<string, unknown>
  nodes?: WorkflowNode[]
  edges?: WorkflowEdge[]
}

