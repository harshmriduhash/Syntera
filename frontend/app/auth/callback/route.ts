import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  // Handle OAuth callback with PKCE
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Auth callback error:', error)
      const url = new URL('/login', requestUrl.origin)
      url.searchParams.set('error', error.message)
      return NextResponse.redirect(url)
    }
  } else {
    // No code parameter - redirect to login with error
    const url = new URL('/login', requestUrl.origin)
    url.searchParams.set('error', 'No authorization code provided')
    return NextResponse.redirect(url)
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}

