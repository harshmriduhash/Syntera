/**
 * Shared types across services
 */

export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface VoiceSettings {
  voice?: string
  language?: string
  speed?: number
  pitch?: number
  video_enabled?: boolean
  screen_sharing_enabled?: boolean
  video_quality?: 'sd' | 'hd' | 'full-hd'
}

export interface AgentConfig {
  id: string
  company_id: string
  name: string
  description?: string
  system_prompt: string
  model: string
  temperature: number
  max_tokens: number
  enabled: boolean
  voice_settings?: VoiceSettings | null
  public_api_key?: string | null
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  agent_id: string
  user_id: string
  channel: 'chat' | 'voice' | 'email'
  status: 'active' | 'ended' | 'archived'
  started_at: string
  ended_at?: string
  metadata?: Record<string, unknown>
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  metadata?: Record<string, unknown>
}

// Export workflow types
export * from './workflow.js'

