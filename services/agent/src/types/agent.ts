/**
 * Agent Configuration Types
 * Proper types to replace type assertions
 */

export interface AgentConfig {
  id: string
  company_id: string
  name: string
  description?: string | null
  system_prompt: string
  model: string
  temperature: number
  max_tokens: number
  enabled: boolean
  voice_settings?: Record<string, unknown>
  public_api_key?: string | null
  created_at?: string
  updated_at?: string
}






