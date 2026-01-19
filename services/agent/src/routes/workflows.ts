/**
 * Workflow CRUD Routes
 */

import express from 'express'
import { z } from 'zod'
import {
  authenticate,
  requireCompany,
  AuthenticatedRequest,
} from '../middleware/auth.js'
import {
  getWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  enableWorkflow,
  disableWorkflow,
  getWorkflowExecutions,
} from '../services/workflow.js'
import { handleError, notFound, badRequest } from '../utils/errors.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import type {
  WorkflowNode,
  WorkflowEdge,
  TriggerType,
} from '@syntera/shared/types/workflow.js'

const logger = createLogger('agent-service:workflows')
const router = express.Router()

// Validation schemas
const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['trigger', 'condition', 'action', 'logic']),
  nodeType: z.union([
    z.enum(['purchase_intent', 'conversation_started', 'conversation_ended', 'contact_created', 'contact_updated', 'deal_created', 'deal_stage_changed', 'message_received', 'webhook']),
    z.enum(['create_deal', 'update_contact', 'update_deal', 'add_tag', 'send_notification', 'send_webhook', 'update_conversation_metadata']),
    z.enum(['if', 'switch', 'and', 'or']),
  ]),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.object({
    label: z.string(),
    config: z.record(z.string(), z.any()),
  }).passthrough(), // Allow additional properties
})

const WorkflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional().nullable(),
  targetHandle: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
})

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
  trigger_type: z.enum([
    'purchase_intent',
    'conversation_started',
    'conversation_ended',
    'contact_created',
    'contact_updated',
    'deal_created',
    'deal_stage_changed',
    'message_received',
    'webhook',
  ]),
  trigger_config: z.record(z.string(), z.any()).optional().nullable(),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
})

const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  trigger_type: z
    .enum([
      'purchase_intent',
      'conversation_started',
      'conversation_ended',
      'contact_created',
      'contact_updated',
      'deal_created',
      'deal_stage_changed',
      'message_received',
      'webhook',
    ])
    .optional(),
  trigger_config: z.record(z.string(), z.unknown()).optional(),
  nodes: z.array(WorkflowNodeSchema).optional(),
  edges: z.array(WorkflowEdgeSchema).optional(),
})

/**
 * GET /api/workflows
 * List all workflows for the authenticated user's company
 */
router.get(
  '/',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const companyId = req.user!.company_id!

      const workflows = await getWorkflows(companyId)

      res.json({ workflows })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * GET /api/workflows/:id
 * Get a specific workflow by ID
 */
router.get(
  '/:id',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!

      const workflow = await getWorkflow(id, companyId)

      if (!workflow) {
        return notFound(res, 'Workflow', id)
      }

      res.json({ workflow })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * POST /api/workflows
 * Create a new workflow
 */
router.post(
  '/',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const companyId = req.user!.company_id!
      logger.info('Creating workflow', { companyId, body: req.body })
      
      const validationResult = CreateWorkflowSchema.safeParse(req.body)
      if (!validationResult.success) {
        logger.error('Workflow validation failed', {
          errors: validationResult.error.issues,
          body: req.body,
        })
        return badRequest(
          res,
          `Validation failed: ${validationResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`
        )
      }

      logger.info('Validation passed, creating workflow', { companyId, name: validationResult.data.name })
      
      // Transform data to match CreateWorkflowInput type
      const workflowData = {
        ...validationResult.data,
        description: validationResult.data.description ?? undefined,
        trigger_config: validationResult.data.trigger_config || {},
        nodes: validationResult.data.nodes.map((node: any) => ({
          ...node,
          data: {
            label: node.data?.label || node.id,
            config: node.data?.config || {},
            ...node.data,
          },
        })),
        edges: validationResult.data.edges.map((edge: any) => ({
          ...edge,
          sourceHandle: edge.sourceHandle ?? undefined,
          targetHandle: edge.targetHandle ?? undefined,
          type: edge.type ?? undefined,
        })),
      }
      
      const workflow = await createWorkflow(companyId, workflowData)
      
      logger.info('Workflow created successfully', { workflowId: workflow.id, companyId })

      res.status(201).json({ workflow })
    } catch (error: any) {
      logger.error('Failed to create workflow', {
        error: error?.message || error,
        errorCode: error?.code,
        errorDetails: error?.details,
        errorHint: error?.hint,
        stack: error?.stack,
        body: req.body,
      })
      handleError(error, res)
    }
  }
)

/**
 * PATCH /api/workflows/:id
 * Update an existing workflow
 */
router.patch(
  '/:id',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!

      const validationResult = UpdateWorkflowSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(
          res,
          `Validation failed: ${validationResult.error.issues[0].message}`
        )
      }

      // Transform data to match UpdateWorkflowInput type
      const workflowData: any = { ...validationResult.data }
      if (workflowData.description === null) {
        workflowData.description = undefined
      }
      if (workflowData.trigger_config === null) {
        workflowData.trigger_config = undefined
      }
      // Transform nodeType to proper type if nodes are provided
      if (workflowData.nodes) {
        workflowData.nodes = workflowData.nodes.map((node: any) => ({
          ...node,
          nodeType: node.nodeType as WorkflowNode['nodeType'],
          data: {
            label: node.data?.label || node.id,
            config: node.data?.config || {},
            ...node.data,
          },
        }))
      }
      // Transform edges to handle null values
      if (workflowData.edges) {
        workflowData.edges = workflowData.edges.map((edge: any) => ({
          ...edge,
          sourceHandle: edge.sourceHandle ?? undefined,
          targetHandle: edge.targetHandle ?? undefined,
          type: edge.type ?? undefined,
        }))
      }

      const workflow = await updateWorkflow(id, companyId, workflowData)

      if (!workflow) {
        return notFound(res, 'Workflow', id)
      }

      res.json({ workflow })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * DELETE /api/workflows/:id
 * Delete a workflow
 */
router.delete(
  '/:id',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!

      const workflow = await getWorkflow(id, companyId)
      if (!workflow) {
        return notFound(res, 'Workflow', id)
      }

      await deleteWorkflow(id, companyId)

      res.json({ success: true })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * POST /api/workflows/:id/enable
 * Enable a workflow
 */
router.post(
  '/:id/enable',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!

      const workflow = await enableWorkflow(id, companyId)

      if (!workflow) {
        return notFound(res, 'Workflow', id)
      }

      res.json({ workflow })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * POST /api/workflows/:id/disable
 * Disable a workflow
 */
router.post(
  '/:id/disable',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!

      const workflow = await disableWorkflow(id, companyId)

      if (!workflow) {
        return notFound(res, 'Workflow', id)
      }

      res.json({ workflow })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * GET /api/workflows/:id/executions
 * Get execution history for a workflow
 */
router.get(
  '/:id/executions',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!
      const limit = parseInt(req.query.limit as string) || 50
      const offset = parseInt(req.query.offset as string) || 0

      const result = await getWorkflowExecutions(id, companyId, limit, offset)

      res.json(result)
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * POST /api/workflows/:id/test
 * Test a workflow (dry run)
 * TODO: Implement test execution engine
 */
router.post(
  '/:id/test',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!

      const workflow = await getWorkflow(id, companyId)
      if (!workflow) {
        return notFound(res, 'Workflow', id)
      }

      // TODO: Implement test execution
      // For now, just return validation success
      res.json({
        success: true,
        message: 'Workflow structure is valid',
        workflow,
      })
    } catch (error) {
      handleError(error, res)
    }
  }
)

export default router


