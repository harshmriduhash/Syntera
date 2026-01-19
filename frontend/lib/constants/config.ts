/**
 * Configuration Constants
 * Application-wide configuration values
 */

// AI Model Configuration
export const AI_MODELS = {
  DEFAULT: 'gpt-4o-mini',
  TURBO: 'gpt-4-turbo-preview',
  GPT4: 'gpt-4',
  GPT4O_MINI: 'gpt-4o-mini',
} as const

// Agent Defaults
export const AGENT_DEFAULTS = {
  PERSONALITY_TONE: 'professional' as const,
  COMMUNICATION_STYLE: 'balanced' as const,
  VOICE: 'cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', // Jacqueline (default)
  TEMPERATURE: 0.7,
  MAX_TOKENS: 800,
  MODEL: 'gpt-4o-mini',
  ENABLED: true,
} as const

// Personality Tones
export const PERSONALITY_TONES = ['professional', 'friendly', 'casual', 'formal', 'enthusiastic'] as const

// Communication Styles
export const COMMUNICATION_STYLES = ['concise', 'detailed', 'balanced'] as const

// Voice Options (LiveKit Inference TTS Providers - No API keys needed)
export const VOICE_OPTIONS = [
  // Cartesia Sonic-3
  { value: 'cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', label: 'Cartesia - Jacqueline (Confident, Young American Female, en-US)' },
  { value: 'cartesia/sonic-3:a167e0f3-df7e-4d52-a9c3-f949145efdab', label: 'Cartesia - Blake (Energetic American Male, en-US)' },
  { value: 'cartesia/sonic-3:f31cc6a7-c1e8-4764-980c-60a361443dd1', label: 'Cartesia - Robyn (Neutral, Mature Australian Female, en-AU)' },
  { value: 'cartesia/sonic-3:5c5ad5e7-1020-476b-8b91-fdcbe9cc313c', label: 'Cartesia - Daniela (Calm, Trusting Mexican Female, es-MX)' },
  
  // ElevenLabs Turbo v2.5 (Most Natural with Emotion Support)
  { value: 'elevenlabs/eleven_turbo_v2_5:21m00Tcm4TlvDq8ikWAM', label: 'ElevenLabs Turbo - Rachel (Natural, Professional Female, en-US) ⭐ Recommended' },
  { value: 'elevenlabs/eleven_turbo_v2_5:Xb7hH8MSUJpSbSDYk0k2', label: 'ElevenLabs Turbo - Alice (Clear, Engaging British Female, en-GB)' },
  { value: 'elevenlabs/eleven_turbo_v2_5:AZnzlk1XvdvUeBnXmlld', label: 'ElevenLabs Turbo - Domi (Energetic, Confident Female, en-US)' },
  { value: 'elevenlabs/eleven_turbo_v2_5:EXAVITQu4vr4xnSDxMaL', label: 'ElevenLabs Turbo - Bella (Calm, Soothing Female, en-US)' },
  { value: 'elevenlabs/eleven_turbo_v2_5:ErXwobaYiN019PkySvjV', label: 'ElevenLabs Turbo - Antoni (Professional, Warm Male, en-US)' },
  { value: 'elevenlabs/eleven_turbo_v2_5:MF3mGyEYCl7XYWbV9V6O', label: 'ElevenLabs Turbo - Elli (Friendly, Conversational Female, en-US)' },
  { value: 'elevenlabs/eleven_turbo_v2_5:iP95p4xoKVk53GoZ742B', label: 'ElevenLabs Turbo - Chris (Natural American Male, en-US)' },
  { value: 'elevenlabs/eleven_turbo_v2_5:cgSgspJ2msm6clMCkdW9', label: 'ElevenLabs Turbo - Jessica (Young, Playful American Female, en-US)' },
  { value: 'elevenlabs/eleven_turbo_v2_5:cjVigY5qzO86Huf0OWal', label: 'ElevenLabs Turbo - Eric (Smooth Tenor Mexican Male, es-MX)' },
  
  // Rime
  { value: 'rime/arcana:astra', label: 'Rime - Astra (Chipper, Upbeat American Female, en-US)' },
  { value: 'rime/arcana:celeste', label: 'Rime - Celeste (Chill Gen-Z American Female, en-US)' },
  { value: 'rime/arcana:luna', label: 'Rime - Luna (Chill but Excitable American Female, en-US)' },
  { value: 'rime/arcana:ursa', label: 'Rime - Ursa (Young, Emo American Male, en-US)' },
  
  // Inworld
  { value: 'inworld/inworld-tts-1:Ashley', label: 'Inworld - Ashley (Warm, Natural American Female, en-US)' },
  { value: 'inworld/inworld-tts-1:Edward', label: 'Inworld - Edward (Fast-talking, Emphatic American Male, en-US)' },
  { value: 'inworld/inworld-tts-1:Olivia', label: 'Inworld - Olivia (Upbeat, Friendly British Female, en-GB)' },
  { value: 'inworld/inworld-tts-1:Diego', label: 'Inworld - Diego (Soothing, Gentle Mexican Male, es-MX)' },
] as const

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ACCEPTED_TYPES: [
    'image/*',
    'application/pdf',
    '.doc',
    '.docx',
    '.txt',
    '.md',
    '.csv',
    '.xls',
    '.xlsx',
  ],
} as const

// Knowledge Base
export const KNOWLEDGE_BASE = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  PROCESSING_TIMEOUT: 300000, // 5 minutes
  CHUNK_SIZE: 1000,
  TOP_K_RESULTS: 5,
} as const
