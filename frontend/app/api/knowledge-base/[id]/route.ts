import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { proxyRequest } from '@/lib/api/proxy'

const KNOWLEDGE_BASE_SERVICE_URL = process.env.KNOWLEDGE_BASE_SERVICE_URL || 'http://localhost:4005'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withAuth(request, async (req, ctx) => {
    return proxyRequest(req, ctx, {
      serviceUrl: KNOWLEDGE_BASE_SERVICE_URL,
      path: `/api/documents/${id}`,
      method: 'DELETE',
    })
  }, { requireCompany: true })
}


