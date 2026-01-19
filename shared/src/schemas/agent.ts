/**
 * Shared Agent Validation Schemas
 * Single source of truth for agent validation across frontend and backend
 */

import { z } from 'zod'

// Voice settings schema
const VoiceSettingsSchema = z.object({
  tts_voice: z.string().optional(), // TTS voice ID (e.g., "cartesia/sonic-3:...", "elevenlabs/eleven_turbo_v2_5:...", "rime/arcana:...", "inworld/inworld-tts-1:...")
})

// Base agent schema (backend structure - authoritative)
export const CreateAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  system_prompt: z.string().min(10, 'System prompt must be at least 10 characters').max(10000, 'System prompt too long'),
  model: z.string().default('gpt-4o-mini'),
  temperature: z.number().min(0).max(2).default(0.7),
  max_tokens: z.number().int().min(100).max(4000).default(800),
  enabled: z.boolean().default(true),
  voice_settings: VoiceSettingsSchema.optional().default({}),
  avatar_url: z.string().url().optional().nullable(),
})

// Update agent schema (all fields optional)
export const UpdateAgentSchema = CreateAgentSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'At least one field must be provided for update',
    path: ['update']
  }
)

// Agent response schema
export const AgentResponseSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  system_prompt: z.string(),
  model: z.string(),
  temperature: z.number(),
  max_tokens: z.number(),
  enabled: z.boolean(),
  voice_settings: z.record(z.string(), z.unknown()).nullable(),
  avatar_url: z.string().url().nullable().optional(),
  public_api_key: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

// Frontend form schema (includes UI-only fields that map to backend structure)
export const AgentFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  system_prompt: z.string().min(10, 'System prompt must be at least 10 characters').max(10000, 'System prompt too long'),
  model: z.string(),
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().int().min(100).max(4000),
  enabled: z.boolean(),
  avatar_url: z.string().url().optional().nullable(),
  // Frontend-specific UI fields (not stored in backend, used for form UX)
  personality_tone: z.enum(['professional', 'friendly', 'casual', 'formal', 'enthusiastic']).optional(),
  communication_style: z.enum(['concise', 'detailed', 'balanced']).optional(),
  voice: z.string().optional(), // Maps to voice_settings.tts_voice
})

// Type exports
export type CreateAgentInput = z.infer<typeof CreateAgentSchema>
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>
export type AgentResponse = z.infer<typeof AgentResponseSchema>
export type AgentFormValues = z.infer<typeof AgentFormSchema>

/**
 * Transform frontend form data to backend format
 * Maps frontend-specific fields to backend structure
 */
export function transformFormToBackend(formData: AgentFormValues): CreateAgentInput {
  return {
    name: formData.name,
    description: formData.description,
    system_prompt: formData.system_prompt,
    model: formData.model,
    temperature: formData.temperature,
    max_tokens: formData.max_tokens,
    enabled: formData.enabled,
    avatar_url: formData.avatar_url || null,
    voice_settings: {
      tts_voice: formData.voice,
    },
  }
}

/**
 * Transform backend agent data to frontend form format
 * Extracts voice_settings.tts_voice to voice field
 */
export function transformBackendToForm(agent: AgentResponse): AgentFormValues {
  const voiceSettings = agent.voice_settings || {}
  const ttsVoice = typeof voiceSettings === 'object' && voiceSettings !== null && 'tts_voice' in voiceSettings
    ? (voiceSettings as { tts_voice?: string }).tts_voice
    : undefined

  return {
    name: agent.name,
    description: agent.description || undefined,
    system_prompt: agent.system_prompt,
    model: agent.model,
    temperature: agent.temperature,
    max_tokens: agent.max_tokens,
    enabled: agent.enabled,
    avatar_url: agent.avatar_url || undefined,
    voice: ttsVoice,
    // Frontend-only fields default to undefined (can be set by form defaults)
    personality_tone: undefined,
    communication_style: undefined,
  }
}






