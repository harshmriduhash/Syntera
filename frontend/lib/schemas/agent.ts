/**
 * Agent Schema
 * Re-exported from shared package for consistency
 * Using client-safe exports to avoid bundling server-only code
 */

export {
  AgentFormSchema as agentSchema,
  transformFormToBackend,
  transformBackendToForm,
  type AgentFormValues,
  type CreateAgentInput,
  type UpdateAgentInput,
  type AgentResponse,
} from '@syntera/shared/client'