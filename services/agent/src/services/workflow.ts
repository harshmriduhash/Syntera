/**
 * Workflow Service
 * Handles workflow CRUD operations and management
 */

import { supabase } from '../config/database.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import type {
  Workflow,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  WorkflowExecution,
} from '@syntera/shared/types/workflow.js'

const logger = createLogger('agent-service:workflow')

/**
 * Get all workflows for a company
 * @param companyId - Company ID to filter workflows
 * @returns Array of workflows, ordered by creation date (newest first)
 * @throws Error if database query fails
 */
export async function getWorkflows(companyId: string): Promise<Workflow[]> {
  try {
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Failed to fetch workflows', { error, companyId })
      throw error
    }

    return (data || []).map(mapWorkflowFromDb)
  } catch (error) {
    logger.error('Error fetching workflows', { error, companyId })
    throw error
  }
}

/**
 * Get a single workflow by ID
 * @param id - Workflow ID
 * @param companyId - Company ID (for authorization)
 * @returns Workflow object or null if not found
 * @throws Error if database query fails
 */
export async function getWorkflow(
  id: string,
  companyId: string
): Promise<Workflow | null> {
  try {
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      logger.error('Failed to fetch workflow', { error, id, companyId })
      throw error
    }

    return data ? mapWorkflowFromDb(data) : null
  } catch (error) {
    logger.error('Error fetching workflow', { error, id, companyId })
    throw error
  }
}

/**
 * Create a new workflow
 * @param companyId - Company ID that owns the workflow
 * @param input - Workflow creation data
 * @returns Created workflow object
 * @throws Error if validation fails or database insert fails
 */
export async function createWorkflow(
  companyId: string,
  input: CreateWorkflowInput
): Promise<Workflow> {
  try {
    logger.info('Creating workflow', { 
      companyId, 
      name: input.name,
      triggerType: input.trigger_type,
      nodesCount: input.nodes?.length || 0,
      edgesCount: input.edges?.length || 0,
    })
    
    const insertData = {
      company_id: companyId,
      name: input.name,
      description: input.description || null,
      enabled: input.enabled ?? true,
      trigger_type: input.trigger_type,
      trigger_config: input.trigger_config || {},
      nodes: input.nodes || [],
      edges: input.edges || [],
    }
    
    const { data, error } = await supabase
      .from('workflows')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('Failed to create workflow', { 
        error: error.message || error, 
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
        companyId, 
        name: input.name,
        triggerType: input.trigger_type,
      })
      throw error
    }

    logger.info('Workflow created successfully', { workflowId: data.id, companyId })
    return mapWorkflowFromDb(data)
  } catch (error: any) {
    logger.error('Error creating workflow', { 
      error: error?.message || error,
      errorCode: error?.code,
      errorStack: error?.stack,
      companyId, 
      name: input.name,
    })
    throw error
  }
}

export async function updateWorkflow(
  id: string,
  companyId: string,
  input: UpdateWorkflowInput
): Promise<Workflow> {
  try {
    const updateData: Record<string, unknown> = {}

    if (input.name !== undefined) updateData.name = input.name
    if (input.description !== undefined) updateData.description = input.description
    if (input.enabled !== undefined) updateData.enabled = input.enabled
    if (input.trigger_type !== undefined) updateData.trigger_type = input.trigger_type
    if (input.trigger_config !== undefined) updateData.trigger_config = input.trigger_config
    if (input.nodes !== undefined) updateData.nodes = input.nodes
    if (input.edges !== undefined) updateData.edges = input.edges

    const { data, error } = await supabase
      .from('workflows')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      logger.error('Failed to update workflow', { error, id, companyId, input })
      throw error
    }

    logger.info('Workflow updated', { workflowId: id, companyId })
    return mapWorkflowFromDb(data)
  } catch (error) {
    logger.error('Error updating workflow', { error, id, companyId, input })
    throw error
  }
}

export async function deleteWorkflow(
  id: string,
  companyId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      logger.error('Failed to delete workflow', { error, id, companyId })
      throw error
    }

    logger.info('Workflow deleted', { workflowId: id, companyId })
  } catch (error) {
    logger.error('Error deleting workflow', { error, id, companyId })
    throw error
  }
}

export async function enableWorkflow(
  id: string,
  companyId: string
): Promise<Workflow> {
  return updateWorkflow(id, companyId, { enabled: true })
}

export async function disableWorkflow(
  id: string,
  companyId: string
): Promise<Workflow> {
  return updateWorkflow(id, companyId, { enabled: false })
}

export async function getWorkflowExecutions(
  workflowId: string,
  companyId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ executions: WorkflowExecution[]; total: number }> {
  try {
    // First verify workflow belongs to company
    const workflow = await getWorkflow(workflowId, companyId)
    if (!workflow) {
      throw new Error('Workflow not found')
    }

    const { data, error, count } = await supabase
      .from('workflow_executions')
      .select('*', { count: 'exact' })
      .eq('workflow_id', workflowId)
      .order('executed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      logger.error('Failed to fetch workflow executions', {
        error,
        workflowId,
        companyId,
      })
      throw error
    }

    return {
      executions: (data || []).map(mapExecutionFromDb),
      total: count || 0,
    }
  } catch (error) {
    logger.error('Error fetching workflow executions', {
      error,
      workflowId,
      companyId,
    })
    throw error
  }
}

export async function createWorkflowExecution(
  execution: Omit<WorkflowExecution, 'id' | 'executed_at'>
): Promise<WorkflowExecution> {
  try {
    const { data, error } = await supabase
      .from('workflow_executions')
      .insert({
        workflow_id: execution.workflow_id,
        status: execution.status,
        triggered_by: execution.triggered_by,
        triggered_by_id: execution.triggered_by_id || null,
        trigger_data: execution.trigger_data || {},
        execution_data: execution.execution_data || {},
        error_message: execution.error_message || null,
        error_stack: execution.error_stack || null,
        execution_time_ms: execution.execution_time_ms || null,
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to create workflow execution', { error, execution })
      throw error
    }

    return mapExecutionFromDb(data)
  } catch (error) {
    logger.error('Error creating workflow execution', { error, execution })
    throw error
  }
}

// Helper functions to map database records to types
function mapWorkflowFromDb(dbRecord: any): Workflow {
  return {
    id: dbRecord.id,
    company_id: dbRecord.company_id,
    name: dbRecord.name,
    description: dbRecord.description,
    enabled: dbRecord.enabled,
    trigger_type: dbRecord.trigger_type,
    trigger_config: dbRecord.trigger_config || {},
    nodes: dbRecord.nodes || [],
    edges: dbRecord.edges || [],
    created_at: dbRecord.created_at,
    updated_at: dbRecord.updated_at,
  }
}

function mapExecutionFromDb(dbRecord: any): WorkflowExecution {
  return {
    id: dbRecord.id,
    workflow_id: dbRecord.workflow_id,
    status: dbRecord.status,
    triggered_by: dbRecord.triggered_by,
    triggered_by_id: dbRecord.triggered_by_id,
    trigger_data: dbRecord.trigger_data || {},
    execution_data: dbRecord.execution_data || {},
    error_message: dbRecord.error_message,
    error_stack: dbRecord.error_stack,
    execution_time_ms: dbRecord.execution_time_ms,
    executed_at: dbRecord.executed_at,
  }
}


