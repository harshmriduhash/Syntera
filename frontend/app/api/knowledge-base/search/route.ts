import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { cache } from '@/lib/api/cache'

const KNOWLEDGE_BASE_SERVICE_URL = process.env.KNOWLEDGE_BASE_SERVICE_URL || 'http://localhost:4005'

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, ctx) => {
    if (!ctx.companyId) {
      return NextResponse.json(
        { error: 'User company not found' },
        { status: 400 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { query, topK = 10, agentId } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Check cache
    const searchCacheKey = `kb-search-${ctx.companyId}-${query}-${topK}-${agentId || 'none'}`
    const cached = cache.get<unknown>(searchCacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'private, max-age=30',
          'X-Cache': 'HIT',
        },
      })
    }

    // Proxy to knowledge base service (with companyId from context)
    const response = await fetch(`${KNOWLEDGE_BASE_SERVICE_URL}/api/documents/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        topK,
        agentId: agentId || null,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Search failed' }))
      return NextResponse.json(
        { error: error.error || 'Search failed' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Cache the result
    cache.set(searchCacheKey, data, 30000)
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=30',
        'X-Cache': 'MISS',
      },
    })
  }, { requireCompany: true })
}


