-- Migration: Add avatar_url column to agent_configs table
-- This allows agents to have profile photos displayed in the widget

ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment
COMMENT ON COLUMN public.agent_configs.avatar_url IS 'URL to the agent profile photo/avatar image';









