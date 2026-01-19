# Sentry Integration Guide

## Backend Services (Node.js)

### 1. Initialize Sentry at service startup

```typescript
import { initSentry } from '@syntera/shared/logger/sentry.js'
import { createLogger } from '@syntera/shared/logger/index.js'

// Initialize Sentry BEFORE creating loggers
initSentry({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.APP_VERSION,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
})

// Now create logger (it will automatically include Sentry transport)
const logger = createLogger('agent-service')
```

### 2. Set user context (when user is authenticated)

```typescript
import { setSentryUser } from '@syntera/shared/logger/sentry.js'

// In your auth middleware or route handler
setSentryUser(userId, userEmail, userName)
```

### 3. Add context to errors

```typescript
import { setSentryContext } from '@syntera/shared/logger/sentry.js'

// Before logging an error
setSentryContext({
  tags: {
    agentId: 'xxx',
    conversationId: 'yyy',
  },
  extra: {
    requestId: 'zzz',
    customData: 'value',
  },
})

logger.error('Something went wrong', { error })
```

### 4. Express error middleware

```typescript
import * as Sentry from '@sentry/node'
import { handleError } from '@syntera/shared/utils/errors.js'

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Capture to Sentry
  Sentry.captureException(err, {
    tags: {
      route: req.path,
      method: req.method,
    },
    extra: {
      body: req.body,
      query: req.query,
    },
  })
  
  // Then handle normally
  handleError(err, res)
})
```

## Environment Variables

Add to your `.env` files:

```bash
# Sentry Configuration
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NODE_ENV=production
APP_VERSION=1.0.0
```

## Example: Agent Service

```typescript
// services/agent/src/index.ts
import { initSentry } from '@syntera/shared/logger/sentry.js'
import { createLogger } from '@syntera/shared/logger/index.js'

// Initialize Sentry first
if (process.env.SENTRY_DSN) {
  initSentry({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
  })
}

// Create logger (will include Sentry if initialized)
const logger = createLogger('agent-service')

// Rest of your service code...
```

