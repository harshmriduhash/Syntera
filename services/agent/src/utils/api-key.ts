/**
 * API Key Utility Functions
 * 
 * Handles generation and validation of public API keys for agent widget access.
 * API keys follow the format: `pub_key_{agentId}` where agentId is a UUID.
 */

/**
 * Generate public API key for an agent
 * Format: pub_key_{agentId}
 * 
 * @param agentId - UUID of the agent
 * @returns API key string in format `pub_key_{agentId}`
 * @throws Error if agentId format is invalid
 */
export function generateApiKey(agentId: string): string {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!agentId || !uuidRegex.test(agentId)) {
    throw new Error(`Invalid agent ID format for API key generation: ${agentId}`)
  }
  return `pub_key_${agentId}`
}

/**
 * Extract agent ID from API key
 * 
 * @param apiKey - API key string (format: pub_key_{agentId})
 * @returns Agent ID if format is valid, null otherwise
 */
export function extractAgentIdFromApiKey(apiKey: string): string | null {
  if (!apiKey || !apiKey.startsWith('pub_key_')) {
    return null
  }
  
  const agentId = apiKey.substring(8) // Remove 'pub_key_' prefix
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(agentId)) {
    return agentId
  }
  
  return null
}

