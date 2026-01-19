# 🤖 Agent Service

**AI orchestration and conversational intelligence core.**

## Overview

The Agent Service is the brain of Syntera's conversational AI platform. It orchestrates AI responses, manages agent configurations, integrates with external APIs, and provides workflow automation capabilities.

**Port**: 4002  
**Technology**: Node.js, Express, TypeScript  
**Database**: PostgreSQL (Supabase) + Redis caching

## Core Responsibilities

### 🤖 AI Agent Management
- **Agent CRUD operations** - Create, read, update, delete AI agents
- **Configuration management** - Model settings, prompts, voice settings
- **Multi-tenant isolation** - Company-scoped agent access

### 💬 Response Generation
- **OpenAI GPT-4 integration** - Intelligent conversation responses
- **Context-aware replies** - Memory of conversation history
- **Workflow triggers** - Automated actions based on conversation events

### 🎤 Voice Integration
- **LiveKit room management** - Voice call coordination
- **Agent dispatch** - Voice agent activation for calls
- **Token generation** - Secure WebRTC authentication

### 🔄 Workflow Automation
- **Custom triggers** - Conversation events, user actions, time-based
- **Action execution** - Send emails, update CRM, create tasks
- **Variable system** - Dynamic data substitution

### 📊 Advanced Features
- **Intent detection** - Understand user intent from messages
- **Sentiment analysis** - Emotional tone classification
- **Knowledge base integration** - RAG-powered responses
- **Contact extraction** - Automatic lead capture from conversations

## API Endpoints

### Agent Management
```
POST   /api/agents              # Create agent
GET    /api/agents              # List agents
GET    /api/agents/:id          # Get agent details
PATCH  /api/agents/:id          # Update agent
DELETE /api/agents/:id          # Delete agent
GET    /api/agents/:id/avatar   # Get agent avatar
```

### AI Responses
```
POST   /api/responses/generate  # Generate AI response
POST   /api/responses/summarize # Summarize conversation
POST   /api/responses/intent    # Detect user intent
POST   /api/responses/sentiment # Analyze sentiment
```

### Voice Integration
```
POST   /api/livekit/token       # Generate LiveKit access token
POST   /api/voice-bot/dispatch  # Dispatch voice agent
```

### Workflows
```
GET    /api/workflows           # List workflows
POST   /api/workflows           # Create workflow
GET    /api/workflows/:id       # Get workflow details
PUT    /api/workflows/:id       # Update workflow
DELETE /api/workflows/:id       # Delete workflow
POST   /api/workflows/:id/test  # Test workflow execution
```

### Analytics & Insights
```
POST   /api/analysis/responses  # Analyze conversation responses
GET    /api/analysis/metrics   # Get agent performance metrics
```

## Architecture

### Service Structure
```
src/
├── config/           # Database and service configuration
├── routes/           # Express route handlers
│   ├── agents.ts     # Agent CRUD operations
│   ├── responses.ts  # AI response generation
│   ├── livekit.ts    # Voice/WebRTC integration
│   ├── workflows.ts  # Workflow management
│   └── internal.ts   # Background processing
├── services/         # Business logic
│   ├── openai.ts     # OpenAI API client
│   ├── workflow-executor.ts # Workflow execution engine
│   └── livekit.ts    # LiveKit integration
├── utils/            # Helper functions
│   ├── errors.ts     # Error handling
│   ├── email.ts      # Email sending
│   └── contacts.ts   # Contact management
├── middleware/       # Express middleware
└── jobs/             # Background job processors
```

### Key Components

#### OpenAI Integration
```typescript
// Intelligent response generation with retry logic
const response = await generateOpenAIResponse({
  prompt: systemPrompt,
  messages: conversationHistory,
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 1000
})
```

#### Workflow Engine
```typescript
// Event-driven automation
const workflowResults = await executeWorkflowsForTrigger(
  'conversation_started',
  {
    conversationId,
    agentId,
    userId,
    message: userMessage
  }
)
```

#### Voice Agent Dispatch
```typescript
// LiveKit room management for voice calls
const roomToken = await generateLiveKitToken({
  identity: `user-${userId}`,
  roomName: conversationId,
  canPublish: true,
  canSubscribe: true
})
```

## Data Flow

### Conversation Processing
1. **Message received** → Chat Service stores in MongoDB
2. **Intent analysis** → Agent Service analyzes user intent
3. **Response generation** → OpenAI generates contextual reply
4. **Workflow execution** → Triggers fire based on conversation events
5. **Contact extraction** → Automatic lead capture from messages

### Voice Call Flow
1. **Call initiated** → Frontend requests LiveKit token
2. **Token generated** → Agent Service creates secure room access
3. **Agent dispatched** → Voice Agent Service joins room
4. **Real-time conversation** → LiveKit handles audio streaming
5. **Session management** → Automatic cleanup on disconnect

## Configuration

### Environment Variables
```bash
# OpenAI
OPENAI_API_KEY=sk-your-key

# LiveKit
LIVEKIT_URL=https://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
REDIS_URL=redis://localhost:6379

# Email (optional)
SENDGRID_API_KEY=your-sendgrid-key
```

## Development

### Local Setup
```bash
cd services/agent
pnpm install
pnpm dev
```

### Testing Endpoints
```bash
# Health check
curl http://localhost:4002/health

# Create agent
curl -X POST http://localhost:4002/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Agent","system_prompt":"You are helpful"}'
```

### Key Development Patterns

#### Error Handling
```typescript
try {
  const result = await riskyOperation()
  return { success: true, data: result }
} catch (error) {
  logger.error('Operation failed', { error: error.message })
  return handleError(error, res)
}
```

#### Database Operations
```typescript
// Always use company-scoped queries
const agents = await supabase
  .from('agent_configs')
  .select('*')
  .eq('company_id', companyId)
```

#### Workflow Triggers
```typescript
// Define trigger conditions
const triggers = [
  { event: 'conversation_started', conditions: {} },
  { event: 'purchase_intent', conditions: { confidence: '>0.8' } }
]
```

## Monitoring & Debugging

### Health Checks
- **GET /health** - Service availability
- **Database connectivity** - Supabase connection status
- **External APIs** - OpenAI, LiveKit reachability

### Logging
- **Structured logging** with Winston
- **Error tracking** with Sentry
- **Performance metrics** for response times
- **Audit trails** for sensitive operations

### Common Issues
- **OpenAI rate limits** - Automatic retry with exponential backoff
- **LiveKit connection errors** - Token validation and regeneration
- **Workflow execution failures** - Detailed error logging and recovery
- **Database timeouts** - Connection pooling and query optimization

## Dependencies

### Core Dependencies
- **@supabase/supabase-js** - Database and auth
- **openai** - AI response generation
- **livekit-server-sdk** - Voice/WebRTC integration
- **express** - HTTP server framework
- **zod** - Input validation
- **winston** - Structured logging

### Development Dependencies
- **typescript** - Type safety
- **tsx** - Development server
- **express-rate-limit** - API abuse prevention

## Performance Considerations

- **Response caching** - Redis for frequently accessed data
- **Connection pooling** - Database connection optimization
- **Rate limiting** - API abuse prevention (100 req/15min)
- **Background processing** - Job queues for heavy operations
- **Horizontal scaling** - Stateless design for multiple instances

## Security Measures

- **JWT authentication** - Secure API access
- **Row Level Security** - Database-level tenant isolation
- **Input validation** - Zod schemas prevent injection attacks
- **Rate limiting** - DDoS and abuse protection
- **Audit logging** - Security event monitoring
- **Environment secrets** - No hardcoded credentials

---

**The intelligent core that powers Syntera's conversational AI capabilities.**
