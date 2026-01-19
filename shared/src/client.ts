/**
 * Client-Safe Exports
 * Exports that are safe to use in browser/client-side code
 * Excludes server-only code (database, Redis, MongoDB, etc.)
 */

// Types (always safe)
export * from './types/index.js'

// Schemas (safe - just Zod schemas)
export * from './schemas/agent.js'

// Error utilities (client-safe version - no server dependencies)
export * from './utils/errors-client.js'

// Models are not exported here because they use mongoose (server-only)
// If you need model types in the frontend, import them directly from types

// Database utilities (Redis, MongoDB, Supabase client) are not exported here
// as they use Node.js built-ins and should only be used server-side

