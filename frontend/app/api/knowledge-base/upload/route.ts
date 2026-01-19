import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/middleware'

const KNOWLEDGE_BASE_SERVICE_URL = process.env.KNOWLEDGE_BASE_SERVICE_URL || 'http://localhost:4005'

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, ctx) => {
    if (!ctx.companyId) {
      return NextResponse.json(
        { error: 'User company not found' },
        { status: 400 }
      )
    }

    // Forward FormData directly to service
    const formData = await req.formData()

    const response = await fetch(`${KNOWLEDGE_BASE_SERVICE_URL}/api/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.session.access_token}`,
        // Don't set Content-Type - let fetch set it with boundary for multipart/form-data
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }))
      return NextResponse.json(error, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  }, { requireCompany: true })
}


