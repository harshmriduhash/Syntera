import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { proxyRequest } from '@/lib/api/proxy'

const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'http://localhost:4004'

/**
 * PATCH /api/conversations/:id/messages/:messageId
 * Update a message (mark as read, add reaction, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id: conversationId, messageId } = await params
  return withAuth(request, async (req, ctx) => {
    return proxyRequest(req, ctx, {
      serviceUrl: CHAT_SERVICE_URL,
      path: `/api/conversations/${conversationId}/messages/${messageId}`,
      method: 'PATCH',
    })
  })
}


