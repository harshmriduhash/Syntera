/**
 * Shared Supabase Client
 * Standardized Supabase client initialization
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '../logger/index.js'

const logger = createLogger('shared:supabase')

let supabaseClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    }

    supabaseClient = createClient(url, key)
    logger.info('Supabase client initialized')
  }

  return supabaseClient
}

export async function verifySupabaseConnection(table: string): Promise<void> {
  const client = getSupabaseClient()
  const { error } = await client.from(table).select('id').limit(1)

  if (error) {
    throw new Error(`Supabase connection failed: ${error.message}`)
  }

  logger.info('Supabase connection verified', { table })
}














