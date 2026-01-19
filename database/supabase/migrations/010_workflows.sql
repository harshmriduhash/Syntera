-- Workflows Schema
-- Enables visual workflow automation with n8n-style node-based builder

-- Workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'purchase_intent',
    'conversation_started',
    'conversation_ended',
    'contact_created',
    'contact_updated',
    'deal_created',
    'deal_stage_changed',
    'message_received',
    'webhook'
  )),
  trigger_config JSONB DEFAULT '{}',
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow executions table (history/logs)
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'running', 'cancelled')),
  triggered_by TEXT NOT NULL,
  triggered_by_id TEXT,
  trigger_data JSONB DEFAULT '{}',
  execution_data JSONB DEFAULT '{}',
  error_message TEXT,
  error_stack TEXT,
  execution_time_ms INTEGER,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_company_id ON public.workflows(company_id);
CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON public.workflows(enabled);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON public.workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON public.workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_executed_at ON public.workflow_executions(executed_at);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_triggered_by ON public.workflow_executions(triggered_by, triggered_by_id);

-- Apply updated_at trigger
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security Policies
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- Workflows RLS Policies
CREATE POLICY "Users can view workflows from their company"
  ON public.workflows FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can create workflows"
  ON public.workflows FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can update workflows"
  ON public.workflows FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can delete workflows"
  ON public.workflows FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Workflow Executions RLS Policies
CREATE POLICY "Users can view workflow executions from their company"
  ON public.workflow_executions FOR SELECT
  USING (
    workflow_id IN (
      SELECT id FROM public.workflows 
      WHERE company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert workflow executions"
  ON public.workflow_executions FOR INSERT
  WITH CHECK (true); -- Service role can insert











