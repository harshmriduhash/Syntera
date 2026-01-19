/**
 * Workflow Execution Engine
 * Executes workflows when triggers fire
 */

import { createLogger } from '@syntera/shared/logger/index.js'
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  NodeExecutionContext,
  NodeExecutionResult,
  WorkflowExecution,
  WorkflowAction,
  WorkflowCondition,
  ConditionOperator,
  CreateDealAction,
  UpdateContactAction,
  UpdateDealAction,
  AddTagAction,
  SendNotificationAction,
  SendWebhookAction,
  UpdateConversationMetadataAction,
} from '@syntera/shared/types/workflow.js'
import { getWorkflows, createWorkflowExecution } from './workflow.js'
import { supabase } from '../config/database.js'
import { fetchWithTimeout } from '../utils/fetch-with-timeout.js'

const logger = createLogger('agent-service:workflow-executor')

/**
 * Execute all enabled workflows matching a trigger type
 * 
 * Finds all workflows for the company that match the trigger type,
 * then executes each one. Continues with other workflows even if one fails.
 * 
 * @param triggerType - Type of trigger (e.g., 'conversation_started', 'contact_created')
 * @param triggerData - Data associated with the trigger event
 * @param companyId - Company ID to filter workflows
 */
export async function executeWorkflowsForTrigger(
  triggerType: string,
  triggerData: Record<string, unknown>,
  companyId: string
): Promise<void> {
  try {
    // Get all enabled workflows for this trigger type
    const workflows = await getWorkflows(companyId)
    const matchingWorkflows = workflows.filter(
      (w) => w.enabled && w.trigger_type === triggerType
    )

    if (matchingWorkflows.length === 0) {
      return
    }

    logger.info('Executing workflows for trigger', {
      triggerType,
      workflowCount: matchingWorkflows.length,
      companyId,
    })

    // Execute each matching workflow
    for (const workflow of matchingWorkflows) {
      try {
        await executeWorkflow(workflow, triggerData, companyId)
      } catch (error) {
        logger.error('Failed to execute workflow', {
          workflowId: workflow.id,
          error,
          triggerType,
        })
        // Continue with other workflows even if one fails
      }
    }
  } catch (error) {
    logger.error('Error executing workflows for trigger', {
      error,
      triggerType,
      companyId,
    })
  }
}

/**
 * Execute a single workflow
 * 
 * Processes workflow nodes in order, evaluating conditions and executing actions.
 * Creates a workflow execution record for tracking.
 * 
 * @param workflow - Workflow definition to execute
 * @param triggerData - Data from the trigger event
 * @param companyId - Company ID (for authorization)
 * @returns Workflow execution record with status and results
 * @throws Error if workflow execution fails
 */
export async function executeWorkflow(
  workflow: Workflow,
  triggerData: Record<string, unknown>,
  companyId: string
): Promise<WorkflowExecution> {
  const startTime = Date.now()
  let execution: WorkflowExecution | null = null

  try {
    // Find trigger node
    const triggerNode = workflow.nodes.find((n) => n.type === 'trigger')
    if (!triggerNode) {
      throw new Error('Workflow must have a trigger node')
    }

    // Check if trigger conditions match
    const triggerMatches = await checkTriggerConditions(
      workflow,
      triggerNode,
      triggerData
    )
    if (!triggerMatches) {
      logger.debug('Trigger conditions not met', {
        workflowId: workflow.id,
        triggerType: workflow.trigger_type,
      })
      // Create execution record for skipped workflow
      execution = await createWorkflowExecution({
        workflow_id: workflow.id,
        status: 'cancelled',
        triggered_by: triggerData.triggered_by as string || 'unknown',
        triggered_by_id: triggerData.triggered_by_id as string,
        trigger_data: triggerData,
        execution_data: {},
        error_message: 'Trigger conditions not met',
      })
      return execution
    }

    // Create execution record
    execution = await createWorkflowExecution({
      workflow_id: workflow.id,
      status: 'running',
      triggered_by: triggerData.triggered_by as string || 'unknown',
      triggered_by_id: triggerData.triggered_by_id as string,
      trigger_data: triggerData,
      execution_data: {},
    })

    // Build execution context with cache for contact/deal data
    const context: NodeExecutionContext & { _cache?: { contact?: any; deal?: any } } = {
      workflow,
      triggerData,
      previousNodeOutputs: {},
      conversationId: triggerData.conversationId as string,
      contactId: triggerData.contactId as string,
      dealId: triggerData.dealId as string,
      messageId: triggerData.messageId as string,
      agentId: triggerData.agentId as string,
      companyId,
      _cache: {}, // Cache for contact/deal data to avoid repeated DB queries
    }

    // Execute workflow nodes starting from trigger
    const executionData = await executeWorkflowNodes(
      workflow,
      triggerNode.id,
      context
    )

    // Update execution as successful
    const executionTime = Date.now() - startTime
    await updateWorkflowExecution(execution.id, {
      status: 'success',
      execution_data: executionData,
      execution_time_ms: executionTime,
    })

    logger.info('Workflow executed successfully', {
      workflowId: workflow.id,
      executionTime,
    })

    return {
      ...execution,
      status: 'success',
      execution_data: executionData,
      execution_time_ms: executionTime,
    }
  } catch (error: any) {
    const executionTime = Date.now() - startTime
    const errorMessage = error?.message || 'Unknown error'
    const errorStack = error?.stack

    logger.error('Workflow execution failed', {
      workflowId: workflow.id,
      error: errorMessage,
      executionTime,
    })

    // Update execution as failed
    if (execution) {
      await updateWorkflowExecution(execution.id, {
        status: 'failed',
        error_message: errorMessage,
        error_stack: errorStack,
        execution_time_ms: executionTime,
      })
    }

    throw error
  }
}

/**
 * Execute workflow nodes starting from a node
 */
async function executeWorkflowNodes(
  workflow: Workflow,
  startNodeId: string,
  context: NodeExecutionContext
): Promise<Record<string, unknown>> {
  const executionData: Record<string, unknown> = {}
  const executedNodes = new Set<string>()
  const nodeQueue: string[] = [startNodeId]

  while (nodeQueue.length > 0) {
    const nodeId = nodeQueue.shift()!
    if (executedNodes.has(nodeId)) {
      logger.debug('Skipping already executed node', { nodeId })
      continue // Skip already executed nodes
    }

    const node = workflow.nodes.find((n) => n.id === nodeId)
    if (!node) {
      logger.warn('Node not found', { nodeId, workflowId: workflow.id })
      continue
    }

    logger.debug('Executing node', { nodeId, nodeType: node.type, workflowId: workflow.id })

    // Execute node
    const result = await processNode(node, context, executionData)
    executedNodes.add(nodeId)

    logger.debug('Node execution result', { 
      nodeId, 
      success: result.success, 
      hasOutput: !!result.output,
      error: result.error 
    })

    // Store node output (even if failed, store error info)
    if (result.output) {
      executionData[nodeId] = result.output
      context.previousNodeOutputs[nodeId] = result.output
    } else if (result.error) {
      // Store error info so we can see what failed
      executionData[nodeId] = {
        success: false,
        error: result.error,
      }
    }

    // Find next nodes to execute
    const nextNodeIds = getNextNodeIds(workflow, nodeId, result)
    logger.debug('Next nodes to execute', { 
      currentNodeId: nodeId, 
      nextNodeIds,
      edgesFromNode: workflow.edges.filter(e => e.source === nodeId).length
    })
    nodeQueue.push(...nextNodeIds)
  }

  return executionData
}

/**
 * Process a single node
 */
async function processNode(
  node: WorkflowNode,
  context: NodeExecutionContext,
  executionData: Record<string, unknown>
): Promise<NodeExecutionResult> {
  try {
    switch (node.type) {
      case 'trigger':
        return {
          success: true,
          output: context.triggerData,
        }

      case 'condition':
        return await processConditionNode(node, context, executionData)

      case 'action':
        return await processActionNode(node, context, executionData)

      case 'logic':
        return {
          success: true,
          output: {},
        }

      default:
        logger.warn('Unknown node type', { nodeType: node.type, nodeId: node.id })
        return {
          success: false,
          error: `Unknown node type: ${node.type}`,
        }
    }
  } catch (error: any) {
    logger.error('Error processing node', {
      nodeId: node.id,
      nodeType: node.type,
      error: error?.message,
    })
    return {
      success: false,
      error: error?.message || 'Unknown error',
    }
  }
}

/**
 * Process condition node (IF)
 */
async function processConditionNode(
  node: WorkflowNode,
  context: NodeExecutionContext,
  executionData: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const condition = node.data.config as unknown as WorkflowCondition
  if (!condition) {
    return {
      success: false,
      error: 'Condition node missing configuration',
    }
  }

  const result = await evaluateCondition(condition, context, executionData)

  return {
    success: true,
    output: {
      conditionResult: result,
    },
    nextNodes: result ? ['yes'] : ['no'],
  }
}

/**
 * Evaluate a condition
 */
async function evaluateCondition(
  condition: WorkflowCondition,
  context: NodeExecutionContext,
  executionData: Record<string, unknown>
): Promise<boolean> {
  const { field, operator, value } = condition

  // Get field value from context
  const fieldValue = await getFieldValue(field, context, executionData)

  // Evaluate based on operator
  switch (operator) {
    case 'equals':
      return fieldValue === value
    case 'not_equals':
      return fieldValue !== value
    case 'contains':
      return String(fieldValue).includes(String(value))
    case 'not_contains':
      return !String(fieldValue).includes(String(value))
    case 'greater_than':
      return Number(fieldValue) > Number(value)
    case 'less_than':
      return Number(fieldValue) < Number(value)
    case 'greater_than_or_equal':
      return Number(fieldValue) >= Number(value)
    case 'less_than_or_equal':
      return Number(fieldValue) <= Number(value)
    case 'is_empty':
      return !fieldValue || String(fieldValue).trim() === ''
    case 'is_not_empty':
      return !!fieldValue && String(fieldValue).trim() !== ''
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null
    case 'not_exists':
      return fieldValue === undefined || fieldValue === null
    default:
      logger.warn('Unknown condition operator', { operator })
      return false
  }
}

/**
 * Get field value from context
 * Supports:
 * - Direct context fields: conversationId, contactId, etc.
 * - triggerData fields: message, intent, confidence, etc.
 * - Nested triggerData: triggerData.message, triggerData.intent
 * - Contact fields: contact.name, contact.email (fetches from DB)
 * - Deal fields: deal.title, deal.value (fetches from DB)
 */
async function getFieldValue(
  field: string,
  context: NodeExecutionContext,
  executionData: Record<string, unknown>
): Promise<unknown> {
  // Handle direct context fields first (conversationId, contactId, dealId, etc.)
  if (field in context && field !== 'triggerData' && field !== 'previousNodeOutputs' && field !== 'workflow') {
    return (context as any)[field]
  }

  // Handle triggerData fields (with or without prefix)
  // Examples: "message", "intent", "confidence", "triggerData.message"
  if (field.startsWith('triggerData.')) {
    const triggerField = field.replace('triggerData.', '')
    return context.triggerData[triggerField]
  }
  
  // Check if it's a direct triggerData field (most common case for purchase_intent)
  // message, intent, confidence, etc. are in triggerData
  if (field in context.triggerData) {
    return context.triggerData[field]
  }

  // Handle contact fields (e.g., contact.name, contact.email)
  if (field.startsWith('contact.')) {
    if (!context.contactId) {
      return undefined
    }
    
    const contactField = field.replace('contact.', '')
    
    // Check cache first to avoid repeated DB queries
    const cache = (context as any)._cache || {}
    if (cache.contact) {
      // Handle name field (combines first_name and last_name)
      if (contactField === 'name') {
        const parts = [cache.contact.first_name, cache.contact.last_name].filter(Boolean)
        return parts.length > 0 ? parts.join(' ') : undefined
      }
      return cache.contact[contactField as keyof typeof cache.contact]
    }
    
    try {
      const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', context.contactId)
        .eq('company_id', context.companyId)
        .single()
      
      if (!contact) {
        return undefined
      }
      
      // Cache the contact for future lookups
      cache.contact = contact
      
      // Handle name field (combines first_name and last_name)
      if (contactField === 'name') {
        const parts = [contact.first_name, contact.last_name].filter(Boolean)
        return parts.length > 0 ? parts.join(' ') : undefined
      }
      
      return contact[contactField as keyof typeof contact]
    } catch (error) {
      logger.warn('Failed to fetch contact for variable', { field, contactId: context.contactId, error })
      return undefined
    }
  }

  // Handle deal fields (e.g., deal.title, deal.value)
  if (field.startsWith('deal.')) {
    if (!context.dealId) {
      return undefined
    }
    
    const dealField = field.replace('deal.', '')
    
    // Check cache first to avoid repeated DB queries
    const cache = (context as any)._cache || {}
    if (cache.deal) {
      return cache.deal[dealField as keyof typeof cache.deal]
    }
    
    try {
      const { data: deal } = await supabase
        .from('deals')
        .select('*')
        .eq('id', context.dealId)
        .eq('company_id', context.companyId)
        .single()
      
      if (!deal) {
        return undefined
      }
      
      // Cache the deal for future lookups
      cache.deal = deal
      
      return deal[dealField as keyof typeof deal]
    } catch (error) {
      logger.warn('Failed to fetch deal for variable', { field, dealId: context.dealId, error })
      return undefined
    }
  }

  // Handle conversation fields
  if (field.startsWith('conversation.')) {
    const convField = field.replace('conversation.', '')
    if (convField === 'id') {
      return context.conversationId
    }
    return undefined
  }

  // Handle nested fields like "previousNodeOutputs.someNode.field"
  const parts = field.split('.')
  let value: any = { ...context, triggerData: context.triggerData, previousNodeOutputs: executionData }

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part]
    } else {
      return undefined
    }
  }

  return value
}

/**
 * Process action node
 */
async function processActionNode(
  node: WorkflowNode,
  context: NodeExecutionContext,
  executionData: Record<string, unknown>
): Promise<NodeExecutionResult> {
  // Get action type from config.type
  const config = node.data.config as unknown as WorkflowAction
  const actionType = config?.type
  
  if (!actionType) {
    return {
      success: false,
      error: 'Action node missing type (config.type is required)',
    }
  }

  // Get action config
  const action = config as WorkflowAction

  try {
    switch (actionType) {
      case 'create_deal':
        return await executeCreateDealAction(action as CreateDealAction, context)

      case 'update_contact':
        return await executeUpdateContactAction(action as UpdateContactAction, context)

      case 'update_deal':
        return await executeUpdateDealAction(action as UpdateDealAction, context)

      case 'add_tag':
        return await executeAddTagAction(action as AddTagAction, context)

      case 'send_notification':
        return await executeSendNotificationAction(action as SendNotificationAction, context)

      case 'send_webhook':
        return await executeSendWebhookAction(action as SendWebhookAction, context)

      case 'update_conversation_metadata':
        return await executeUpdateConversationMetadataAction(action as UpdateConversationMetadataAction, context)

      default:
        return {
          success: false,
          error: `Action type not implemented: ${action.type}`,
        }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Action execution failed',
    }
  }
}

/**
 * Execute create deal action
 */
async function executeCreateDealAction(
  action: Extract<WorkflowAction, { type: 'create_deal' }>,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  // Get title from config or use default
  const title = action.title 
    ? await replaceVariables(action.title, context)
    : `Deal from ${context.triggerData.triggered_by as string}`
  
  // Default to 'auto' if contact_id is not specified
  const contactIdConfig = action.contact_id || 'auto'
  const contactId = contactIdConfig === 'auto' ? context.contactId : contactIdConfig

  if (!contactId) {
    return {
      success: false,
      error: 'Contact ID is required to create deal. Make sure the trigger provides contactId or set contact_id in action config.',
    }
  }

  // Parse value if it's a string with variables
  let dealValue: number | null = null
  if (action.value) {
    const valueStr = typeof action.value === 'string' 
      ? await replaceVariables(action.value, context)
      : String(action.value)
    dealValue = valueStr ? parseFloat(valueStr) : null
  }

  // Parse expected_close_date if it's a string with variables
  let expectedCloseDate: string | null = null
  if (action.expected_close_date) {
    expectedCloseDate = typeof action.expected_close_date === 'string'
      ? await replaceVariables(action.expected_close_date, context)
      : action.expected_close_date
    // Validate date format
    if (expectedCloseDate && isNaN(Date.parse(expectedCloseDate))) {
      logger.warn('Invalid expected_close_date format', { expectedCloseDate })
      expectedCloseDate = null
    }
  }

  // Create deal directly in Supabase (avoids authentication issues)
  const { data: deal, error } = await supabase
    .from('deals')
    .insert({
      company_id: context.companyId,
      contact_id: contactId,
      title,
      value: dealValue,
      stage: action.stage || 'lead',
      probability: action.probability || 0,
      expected_close_date: expectedCloseDate,
      metadata: action.metadata || {},
    })
    .select('*, contacts(*)')
    .single()

  if (error) {
    logger.error('Failed to create deal in workflow', {
      error: error.message,
      dealData: { title, contactId, companyId: context.companyId },
    })
    return {
      success: false,
      error: `Failed to create deal: ${error.message}`,
    }
  }

  // Trigger deal_created workflows (if any)
  try {
    await executeWorkflowsForTrigger('deal_created', {
      triggered_by: 'deal',
      triggered_by_id: deal.id,
      dealId: deal.id,
      contactId: deal.contact_id,
      companyId: context.companyId,
      stage: deal.stage,
      value: deal.value,
      title: deal.title,
    }, context.companyId)
  } catch (error) {
    // Log but don't fail the action if workflow triggering fails
    logger.warn('Failed to trigger deal_created workflows', { error })
  }

  logger.info('Deal created successfully in workflow', {
    dealId: deal.id,
    title: deal.title,
    contactId: deal.contact_id,
    companyId: context.companyId,
  })

  return {
    success: true,
    output: {
      dealId: deal.id,
      deal: deal,
    },
  }
}

/**
 * Execute update contact action
 */
async function executeUpdateContactAction(
  action: Extract<WorkflowAction, { type: 'update_contact' }>,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const contactId = action.contact_id === 'auto' ? context.contactId : action.contact_id

  if (!contactId) {
    return {
      success: false,
      error: 'Contact ID is required to update contact',
    }
  }

  // Update contact via Supabase
  const updateData: Record<string, unknown> = {}
  if (action.fields) {
    Object.assign(updateData, action.fields)
  }
  if (action.metadata) {
    updateData.metadata = action.metadata
  }

  const { error } = await supabase
    .from('contacts')
    .update(updateData)
    .eq('id', contactId)
    .eq('company_id', context.companyId)

  if (error) {
    return {
      success: false,
      error: `Failed to update contact: ${error.message}`,
    }
  }

  // Add tags if specified
  if (action.add_tags && action.add_tags.length > 0) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('tags')
      .eq('id', contactId)
      .single()

    const existingTags = (contact?.tags || []) as string[]
    const newTags = [...new Set([...existingTags, ...action.add_tags])]

    await supabase
      .from('contacts')
      .update({ tags: newTags })
      .eq('id', contactId)
  }

  return {
    success: true,
    output: {
      contactId,
      updated: true,
    },
  }
}

/**
 * Execute update deal action
 */
async function executeUpdateDealAction(
  action: Extract<WorkflowAction, { type: 'update_deal' }>,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const dealId = action.deal_id === 'auto' ? context.dealId : action.deal_id

  if (!dealId) {
    return {
      success: false,
      error: 'Deal ID is required to update deal',
    }
  }

  // Get current deal to check stage before update
  const { data: currentDeal } = await supabase
    .from('deals')
    .select('stage, contact_id')
    .eq('id', dealId)
    .eq('company_id', context.companyId)
    .single()

  if (!currentDeal) {
    return {
      success: false,
      error: 'Deal not found',
    }
  }

  const previousStage = currentDeal.stage

  const updateData: Record<string, unknown> = {}
  if (action.fields) {
    Object.assign(updateData, action.fields)
  }
  if (action.metadata) {
    updateData.metadata = action.metadata
  }

  const { data: updatedDeal, error } = await supabase
    .from('deals')
    .update(updateData)
    .eq('id', dealId)
    .eq('company_id', context.companyId)
    .select('stage, contact_id, title, value')
    .single()

  if (error) {
    return {
      success: false,
      error: `Failed to update deal: ${error.message}`,
    }
  }

  // Trigger deal_stage_changed workflows if stage changed
  const newStage = updatedDeal?.stage
  if (newStage && previousStage && previousStage !== newStage) {
    try {
      await executeWorkflowsForTrigger('deal_stage_changed', {
        triggered_by: 'deal',
        triggered_by_id: dealId,
        dealId,
        contactId: updatedDeal.contact_id,
        companyId: context.companyId,
        from_stage: previousStage,
        to_stage: newStage,
      }, context.companyId)
    } catch (error) {
      // Log but don't fail the action if workflow triggering fails
      logger.warn('Failed to trigger deal_stage_changed workflows', { error, dealId })
    }
  }

  return {
    success: true,
    output: {
      dealId,
      updated: true,
    },
  }
}

/**
 * Execute add tag action
 */
async function executeAddTagAction(
  action: Extract<WorkflowAction, { type: 'add_tag' }>,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const contactId = action.contact_id === 'auto' ? context.contactId : action.contact_id

  if (!contactId) {
    return {
      success: false,
      error: 'Contact ID is required to add tag',
    }
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('tags')
    .eq('id', contactId)
    .eq('company_id', context.companyId)
    .single()

  if (!contact) {
    return {
      success: false,
      error: 'Contact not found',
    }
  }

  const existingTags = (contact.tags || []) as string[]
  const newTags = [...new Set([...existingTags, ...action.tags])]

  const { error } = await supabase
    .from('contacts')
    .update({ tags: newTags })
    .eq('id', contactId)
    .eq('company_id', context.companyId)

  if (error) {
    return {
      success: false,
      error: `Failed to add tag: ${error.message}`,
    }
  }

  return {
    success: true,
    output: {
      contactId,
      tags: newTags,
    },
  }
}

/**
 * Execute send notification action
 */
async function executeSendNotificationAction(
  action: Extract<WorkflowAction, { type: 'send_notification' }>,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  try {
    const title = await replaceVariables(action.title, context)
    const message = await replaceVariables(action.message, context)
    const notificationType = action.notification_type || 'in_app'

    // Find user by email or user_id
    let userId: string | null = null

    // Check if 'to' is a UUID (user_id) or email
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(action.to)

    if (isUUID) {
      // It's a user_id
      userId = action.to
    } else {
      // It's an email, find user by email in users table
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', action.to)
        .eq('company_id', context.companyId)
        .maybeSingle()

      if (user) {
        userId = user.id
      }
    }

    if (!userId) {
      return {
        success: false,
        error: `User not found: ${action.to}`,
      }
    }

    // Create in-app notification
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        company_id: context.companyId,
        title,
        message,
        type: 'workflow',
        metadata: {
          workflow_id: context.workflow.id,
          triggered_by: context.triggerData.triggered_by,
          triggered_by_id: context.triggerData.triggered_by_id,
        },
      })
      .select()
      .single()

    if (notificationError) {
      logger.error('Failed to create notification', {
        error: notificationError,
        userId,
        title,
      })
      return {
        success: false,
        error: `Failed to create notification: ${notificationError.message}`,
      }
    }

    // Send email if notification_type is 'email'
    if (notificationType === 'email') {
      try {
        const { sendEmail } = await import('../utils/email.js')
        await sendEmail({
          to: action.to,
          subject: title,
          html: message.replace(/\n/g, '<br>'),
          text: message,
        })
      } catch (emailError: any) {
        logger.error('Failed to send email notification', {
          error: emailError,
          to: action.to,
        })
        // Don't fail the action if email fails, notification was created
      }
    }

    logger.info('Notification sent', {
      userId,
      notificationId: notification.id,
      type: notificationType,
      workflowId: context.workflow.id,
    })

    return {
      success: true,
      output: {
        notificationId: notification.id,
        notificationSent: true,
        notificationType,
      },
    }
  } catch (error: any) {
    logger.error('Error sending notification', {
      error: error?.message,
      stack: error?.stack,
    })
    return {
      success: false,
      error: error?.message || 'Failed to send notification',
    }
  }
}

/**
 * Execute send webhook action
 */
async function executeSendWebhookAction(
  action: Extract<WorkflowAction, { type: 'send_webhook' }>,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  try {
    const url = await replaceVariables(action.url, context)
    const payload = action.body || {}

    // Replace variables in payload
    const payloadStr = JSON.stringify(payload)
    const matches = payloadStr.match(/\{\{(\w+(?:\.\w+)*)\}\}/g)
    let processedPayloadStr = payloadStr
    
    if (matches) {
      for (const match of matches) {
        const path = match.replace(/\{\{|\}\}/g, '')
        const value = await getFieldValue(path, context, {})
        if (value !== undefined) {
          processedPayloadStr = processedPayloadStr.replace(match, JSON.stringify(value))
        }
      }
    }
    
    const processedPayload = JSON.parse(processedPayloadStr)

    const response = await fetchWithTimeout(
      url,
      {
        method: action.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(action.headers || {}),
        },
        body: JSON.stringify(processedPayload),
      },
      10000
    )

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `Webhook failed: ${response.status} ${errorText}`,
      }
    }

    const responseData = await response.json().catch(() => ({}))

    return {
      success: true,
      output: {
        webhookSent: true,
        status: response.status,
        response: responseData,
      },
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to send webhook',
    }
  }
}

/**
 * Execute update conversation metadata action
 */
async function executeUpdateConversationMetadataAction(
  action: Extract<WorkflowAction, { type: 'update_conversation_metadata' }>,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const conversationId = action.conversation_id === 'auto' ? context.conversationId : action.conversation_id

  if (!conversationId) {
    return {
      success: false,
      error: 'Conversation ID is required to update metadata',
    }
  }

  try {
    const chatServiceUrl = process.env.CHAT_SERVICE_URL
    if (!chatServiceUrl) {
      throw new Error('CHAT_SERVICE_URL environment variable is required')
    }
    const response = await fetchWithTimeout(
      `${chatServiceUrl}/api/internal/conversations/${conversationId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_TOKEN || ''}`,
        },
        body: JSON.stringify({
          metadata: action.metadata || {},
        }),
      },
      5000
    )

    if (!response.ok) {
      const error = await response.text()
      return {
        success: false,
        error: `Failed to update conversation metadata: ${error}`,
      }
    }

    return {
      success: true,
      output: {
        conversationId,
        updated: true,
      },
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to update conversation metadata',
    }
  }
}

/**
 * Get next node IDs based on edges and node result
 */
function getNextNodeIds(
  workflow: Workflow,
  currentNodeId: string,
  nodeResult: NodeExecutionResult
): string[] {
  const nextNodeIds: string[] = []

  // Find edges from current node
  const edges = workflow.edges.filter((e) => e.source === currentNodeId)

  for (const edge of edges) {
    // For condition nodes, check if edge matches the result
    if (nodeResult.nextNodes) {
      if (edge.sourceHandle && nodeResult.nextNodes.includes(edge.sourceHandle)) {
        nextNodeIds.push(edge.target)
      }
    } else {
      // For other nodes, follow all edges
      nextNodeIds.push(edge.target)
    }
  }

  return nextNodeIds
}

/**
 * Check if trigger conditions match
 */
async function checkTriggerConditions(
  workflow: Workflow,
  triggerNode: WorkflowNode,
  triggerData: Record<string, unknown>
): Promise<boolean> {
  const config = workflow.trigger_config

  switch (workflow.trigger_type) {
    case 'purchase_intent':
      const intentType = config.intent_type as string | undefined
      const confidenceThreshold = (config.confidence_threshold as number) || 0.8
      const detectedIntent = triggerData.intent as string
      const confidence = (triggerData.confidence as number) || 0

      if (intentType && detectedIntent !== intentType) {
        return false
      }
      return confidence >= confidenceThreshold

    case 'conversation_started':
      const agentId = config.agent_id as string | undefined
      if (agentId && triggerData.agentId !== agentId) {
        return false
      }
      return true

    case 'contact_created':
      const source = config.source as string | undefined
      if (source && triggerData.source !== source) {
        return false
      }
      return true

    case 'conversation_ended':
      const endedAgentId = config.agent_id as string | undefined
      const endedChannel = config.channel as string | undefined
      const durationMin = config.duration_min as number | undefined

      if (endedAgentId && triggerData.agentId !== endedAgentId) {
        return false
      }
      if (endedChannel && triggerData.channel !== endedChannel) {
        return false
      }
      if (durationMin !== undefined && (triggerData.duration_min as number || 0) < durationMin) {
        return false
      }
      return true

    case 'contact_updated':
      const updatedSource = config.source as string | undefined
      const fieldsChanged = config.fields_changed as string[] | undefined

      if (updatedSource && triggerData.source !== updatedSource) {
        return false
      }
      if (fieldsChanged && fieldsChanged.length > 0) {
        const actualFieldsChanged = (triggerData.fields_changed as string[]) || []
        const hasMatchingField = fieldsChanged.some((field) => actualFieldsChanged.includes(field))
        if (!hasMatchingField) {
          return false
        }
      }
      return true

    case 'deal_created':
      const dealStage = config.stage as string | undefined
      const minValue = config.min_value as number | undefined
      const dealContactId = config.contact_id as string | undefined

      if (dealStage && triggerData.stage !== dealStage) {
        return false
      }
      if (minValue !== undefined && (triggerData.value as number || 0) < minValue) {
        return false
      }
      if (dealContactId && triggerData.contactId !== dealContactId) {
        return false
      }
      return true

    case 'deal_stage_changed':
      const fromStage = config.from_stage as string | undefined
      const toStage = config.to_stage as string | undefined
      const dealId = config.deal_id as string | undefined

      if (fromStage && triggerData.from_stage !== fromStage) {
        return false
      }
      if (toStage && triggerData.to_stage !== toStage) {
        return false
      }
      if (dealId && triggerData.dealId !== dealId) {
        return false
      }
      return true

    case 'message_received':
      const messageKeywords = config.keywords as string[] | undefined
      const messageAgentId = config.agent_id as string | undefined
      const messageChannel = config.channel as string | undefined

      if (messageAgentId && triggerData.agentId !== messageAgentId) {
        return false
      }
      if (messageChannel && triggerData.channel !== messageChannel) {
        return false
      }
      if (messageKeywords && messageKeywords.length > 0) {
        const messageText = (triggerData.message as string || '').toLowerCase()
        const hasKeyword = messageKeywords.some((keyword) => messageText.includes(keyword.toLowerCase()))
        if (!hasKeyword) {
          return false
        }
      }
      return true

    case 'webhook':
      // Webhook triggers always fire (no conditions)
      return true

    default:
      return true
  }
}

/**
 * Replace variables in text (e.g., {{contact.name}}, {{message}})
 */
async function replaceVariables(
  text: string,
  context: NodeExecutionContext
): Promise<string> {
  const matches = text.match(/\{\{(\w+(?:\.\w+)*)\}\}/g)
  if (!matches) {
    return text
  }

  let result = text
  for (const match of matches) {
    const path = match.replace(/\{\{|\}\}/g, '')
    const value = await getFieldValue(path, context, {})
    if (value !== undefined) {
      result = result.replace(match, String(value))
    }
  }

  return result
}

/**
 * Update workflow execution
 */
async function updateWorkflowExecution(
  executionId: string,
  updates: Partial<WorkflowExecution>
): Promise<void> {
  try {
    const updateData: Record<string, unknown> = {}
    if (updates.status) updateData.status = updates.status
    if (updates.execution_data) updateData.execution_data = updates.execution_data
    if (updates.error_message !== undefined) updateData.error_message = updates.error_message
    if (updates.error_stack !== undefined) updateData.error_stack = updates.error_stack
    if (updates.execution_time_ms !== undefined) updateData.execution_time_ms = updates.execution_time_ms

    const { error } = await supabase
      .from('workflow_executions')
      .update(updateData)
      .eq('id', executionId)

    if (error) {
      logger.error('Failed to update workflow execution', { error, executionId })
    }
  } catch (error) {
    logger.error('Error updating workflow execution', { error, executionId })
  }
}

