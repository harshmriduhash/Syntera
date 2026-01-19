# Syntera Shared Utilities

**Common code shared across all services and frontend.**

## Package Structure

```
shared/
├── src/
│   ├── client.ts          # Frontend-safe exports
│   ├── database/          # Database clients
│   │   ├── supabase.ts    # PostgreSQL client
│   │   ├── mongodb.ts     # MongoDB client
│   │   └── redis.ts       # Redis client
│   ├── logger/            # Structured logging
│   │   ├── index.ts       # Logger utilities
│   │   └── sentry.ts      # Sentry error tracking
│   ├── models/            # MongoDB schemas
│   │   ├── conversation.ts # Conversation model
│   │   └── message.ts     # Message model
│   ├── schemas/           # Zod validation schemas
│   │   └── agent.ts       # Agent validation
│   ├── types/             # TypeScript interfaces
│   │   ├── index.ts       # Common types
│   │   └── workflow.ts    # Workflow types
│   ├── seed/              # Database seeding
│   └── utils/             # Shared utilities
│       ├── errors.ts      # Error handling
│       └── errors-client.ts # Frontend error utils
```

## Key Exports

### Database Clients
```typescript
import { getSupabaseClient } from '@syntera/shared/database/supabase'
import { getMongoClient } from '@syntera/shared/database/mongodb'
import { getRedisClient } from '@syntera/shared/database/redis'
```

### Models
```typescript
import { Conversation, Message } from '@syntera/shared/models'
```

### Types
```typescript
import type {
  AgentConfig,
  Conversation,
  Message,
  Workflow
} from '@syntera/shared/types'
```

### Utilities
```typescript
import { createLogger } from '@syntera/shared/logger'
import { handleError } from '@syntera/shared/utils/errors'
```

## Usage Examples

### Database Operations
```typescript
// Supabase (PostgreSQL)
const supabase = getSupabaseClient()
const { data: agents } = await supabase
  .from('agent_configs')
  .select('*')
  .eq('company_id', companyId)

// MongoDB
const mongo = getMongoClient()
const conversations = await mongo
  .collection('conversations')
  .find({ company_id: companyId })

// Redis
const redis = getRedisClient()
await redis.set('session:' + userId, sessionData)
```

### Error Handling
```typescript
import { handleError } from '@syntera/shared/utils/errors'

try {
  await riskyOperation()
} catch (error) {
  return handleError(error, res)
}
```

### Logging
```typescript
import { createLogger } from '@syntera/shared/logger'

const logger = createLogger('service-name')
logger.info('Operation completed', { userId, duration: 150 })
logger.error('Database error', { error: err.message })
```

## Build Process

```bash
# Build shared utilities
pnpm build

# Watch mode for development
pnpm dev
```

## Dependencies

- **Zod**: Runtime type validation
- **Winston**: Structured logging
- **Sentry**: Error tracking
- **MongoDB Driver**: Database operations
- **Redis Client**: Caching operations

## Version Compatibility

- **Node.js**: 18+
- **TypeScript**: 5.0+
- **MongoDB**: 6.0+
- **PostgreSQL**: 13+
- **Redis**: 6.0+
