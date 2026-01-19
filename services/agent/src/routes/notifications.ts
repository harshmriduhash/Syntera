/**
 * Notifications API Routes
 * Handles in-app notifications
 */

import { Router } from 'express'
import { authenticate, requireCompany, AuthenticatedRequest } from '../middleware/auth.js'
import { handleError, notFound } from '../utils/errors.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { supabase } from '../config/database.js'

const logger = createLogger('agent-service:notifications')
const router = Router()

/**
 * GET /api/notifications
 * Get user's notifications
 */
router.get(
  '/',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id
      const limit = parseInt(req.query.limit as string) || 50
      const offset = parseInt(req.query.offset as string) || 0
      const unreadOnly = req.query.unread === 'true'

      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (unreadOnly) {
        query = query.eq('read', false)
      }

      const { data: notifications, error, count } = await query

      if (error) {
        logger.error('Failed to fetch notifications', { error, userId })
        return handleError(error, res)
      }

      res.json({
        notifications: notifications || [],
        total: count || 0,
      })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get(
  '/unread-count',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false)

      if (error) {
        logger.error('Failed to fetch unread count', { error, userId })
        return handleError(error, res)
      }

      res.json({ count: count || 0 })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch(
  '/:id/read',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const userId = req.user!.id

      const { data: notification, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (fetchError || !notification) {
        return notFound(res, 'Notification', id)
      }

      const { error } = await supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) {
        logger.error('Failed to mark notification as read', { error, id, userId })
        return handleError(error, res)
      }

      res.json({ success: true })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
router.patch(
  '/read-all',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id

      const { error } = await supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('read', false)

      if (error) {
        logger.error('Failed to mark all notifications as read', { error, userId })
        return handleError(error, res)
      }

      res.json({ success: true })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * POST /api/notifications
 * Create a notification (internal use, e.g., from workflows)
 * Requires service role or authenticated user
 */
router.post(
  '/',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { user_id, title, message, type, metadata } = req.body

      if (!user_id || !title || !message) {
        return res.status(400).json({
          error: 'Missing required fields: user_id, title, message',
        })
      }

      // Verify user belongs to same company
      const { data: targetUser } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user_id)
        .single()

      if (!targetUser || targetUser.company_id !== req.user!.company_id) {
        return res.status(403).json({ error: 'Cannot create notification for user in different company' })
      }

      const { data: notification, error } = await supabase
        .from('notifications')
        .insert({
          user_id,
          company_id: req.user!.company_id!,
          title,
          message,
          type: type || 'info',
          metadata: metadata || {},
        })
        .select()
        .single()

      if (error) {
        logger.error('Failed to create notification', { error, user_id, title })
        return handleError(error, res)
      }

      res.status(201).json({ notification })
    } catch (error) {
      handleError(error, res)
    }
  }
)

export default router










