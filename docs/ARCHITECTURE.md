# Syntera Architecture Guide

**Technical Architecture and System Design**

This document outlines the system architecture, design decisions, and technical implementation of the Syntera conversational AI platform.

---

## 🏗️ System Overview

Syntera is a multi-tenant SaaS platform that enables enterprises to deploy AI-powered customer service agents. The system handles real-time conversations across multiple channels with robust security measures.

### Core Capabilities
- **Multi-channel AI conversations** (chat, voice)
- **Intelligent agent orchestration** with workflow automation
- **Knowledge bases** with RAG capabilities
- **Real-time analytics** and performance monitoring
- **CRM integration** for customer data management

---

## 🏛️ High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Web[Web Browsers]
        Mobile[Mobile Apps]
        API[Third-party APIs]
    end

    subgraph "Edge Services"
        CDN[CDN/Edge Network]
        LB[Load Balancer]
        WAF[WAF & Security]
    end

    subgraph "Application Layer"
        FE[Frontend - Next.js]
        GW[API Gateway]
    end

    subgraph "Service Layer"
        AS[Agent Service]
        CS[Chat Service]
        KB[Knowledge Base]
        VS[Voice Service]
        WS[Workflow Service]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL)]
        MONGO[(MongoDB)]
        REDIS[(Redis Cache)]
        PINECONE[(Pinecone Vector DB)]
    end

    subgraph "External Services"
        OPENAI[OpenAI API]
        LIVEKIT[LiveKit RTC]
        SUPABASE[Supabase Auth]
    end

    Web --> CDN
    Mobile --> CDN
    API --> CDN

    CDN --> LB
    LB --> WAF
    WAF --> FE

    FE --> GW
    GW --> AS
    GW --> CS
    GW --> KB
    GW --> VS
    GW --> WS

    AS --> PG
    AS --> MONGO
    AS --> REDIS
    CS --> MONGO
    CS --> REDIS
    KB --> PINECONE
    KB --> PG

    AS --> OPENAI
    VS --> LIVEKIT
    FE --> SUPABASE

    style FE fill:#e1f5fe
    style GW fill:#f3e5f5
    style AS fill:#e8f5e8
    style PG fill:#fff3e0
    style OPENAI fill:#fce4ec
```

**Key Design Principles:**
- **Microservices architecture** for scalability and maintainability
- **Event-driven communication** between services
- **Multi-tenant data isolation** at all layers
- **Real-time capabilities** for live interactions
- **Security** with comprehensive access controls

---

## 🔄 Data Flow Architecture

### Conversation Flow
```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant GW as API Gateway
    participant CS as Chat Service
    participant AS as Agent Service
    participant AI as OpenAI
    participant DB as Database

    U->>FE: Send message
    FE->>GW: POST /api/conversations/:id/messages
    GW->>CS: Route to chat service
    CS->>DB: Store message
    CS->>AS: Trigger agent response
    AS->>DB: Get agent configuration
    AS->>AI: Generate AI response
    AI-->>AS: Return response
    AS->>DB: Store AI response
    AS-->>CS: Response ready
    CS-->>GW: Return response
    GW-->>FE: Stream to user
    FE-->>U: Display response
```

### Authentication Flow
```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant SB as Supabase
    participant GW as API Gateway
    participant SRV as Service

    U->>FE: Login request
    FE->>SB: Authenticate user
    SB-->>FE: JWT token
    FE->>GW: API request + JWT
    GW->>SB: Validate token
    SB-->>GW: User context
    GW->>SRV: Request + company context
    SRV->>DB: Company-scoped query
    DB-->>SRV: Filtered results
    SRV-->>GW: Response
    GW-->>FE: Filtered data
```

---

## 🗂️ Component Architecture

### Frontend Architecture (Next.js)

```
frontend/
├── app/                    # Next.js 13+ app router
│   ├── api/               # API routes (server-side)
│   ├── dashboard/         # Main application pages
│   ├── auth/             # Authentication flows
│   └── page.tsx          # Landing page
├── components/            # Reusable UI components
│   ├── ui/               # Base UI library
│   ├── dashboard/        # Dashboard components
│   ├── chat/            # Chat interface
│   └── workflows/       # Workflow builder
├── lib/                  # Utilities and configurations
│   ├── api/             # API client functions
│   ├── supabase/        # Database client
│   └── livekit/         # Real-time client
└── hooks/                # Custom React hooks
```

**Key Patterns:**
- **Server Components** for data fetching
- **Client Components** for interactivity
- **API Routes** as backend-for-frontend
- **Optimistic Updates** for real-time UX

### Backend Services Architecture

#### Agent Service (Node.js/TypeScript)
```
services/agent/
├── src/
│   ├── routes/           # API endpoints
│   │   ├── agents.ts    # Agent CRUD
│   │   ├── responses.ts # AI generation
│   │   └── workflows.ts # Workflow execution
│   ├── services/        # Business logic
│   │   ├── openai.ts    # AI integration
│   │   └── livekit.ts   # Real-time setup
│   └── middleware/      # Auth & validation
└── config/
    └── database.ts      # Supabase client
```

#### Chat Service (Node.js/TypeScript)
```
services/chat/
├── src/
│   ├── handlers/        # Socket.io handlers
│   ├── routes/          # REST endpoints
│   └── models/          # MongoDB schemas
└── utils/
    └── cache.ts         # Redis operations
```

#### Knowledge Base Service (Node.js/TypeScript)
```
services/knowledge-base/
├── src/
│   ├── services/        # Core logic
│   │   ├── embeddings.ts # Text processing
│   │   ├── pinecone.ts   # Vector operations
│   │   └── chunker.ts    # Document splitting
│   └── routes/          # API endpoints
└── files/               # Document storage
```

#### Voice Agent Service (Python)
```
services/voice-agent/
├── src/
│   ├── agent.py         # LiveKit agent logic
│   ├── config.py        # Service configuration
│   ├── contact_extractor.py # CRM integration
│   └── knowledge_base.py # RAG queries
└── utils/
    └── logger.py        # Structured logging
```

---

## 💾 Data Architecture

### Database Strategy

**PostgreSQL (Supabase)** - Business Data
- **Agent configurations** (company-scoped)
- **CRM data** (contacts, deals)
- **User management** (multi-tenant users)
- **Workflow definitions**
- **Analytics metadata**

**Why PostgreSQL:**
- ACID transactions for business data
- Advanced querying for analytics
- Row Level Security for multi-tenancy
- JSONB for flexible metadata

**MongoDB** - Conversation Data
- **Message history** (high-volume writes)
- **Conversation threads** (flexible schemas)
- **Real-time chat data**

**Why MongoDB:**
- High write throughput for messages
- Flexible document schemas
- Horizontal scaling for chat data
- Fast queries for conversation history

**Redis** - Caching & Sessions
- **Session management**
- **Rate limiting data**
- **Temporary caches**
- **Real-time pub/sub**

**Pinecone** - Vector Search
- **Document embeddings**
- **Semantic search**
- **RAG context retrieval**

### Data Flow Patterns

```mermaid
graph TD
    subgraph "Write-Heavy"
        MSG[Messages] --> MONGO[(MongoDB)]
        CONV[Conversations] --> MONGO
    end

    subgraph "Read-Heavy"
        AGENTS[Agent Configs] --> PG[(PostgreSQL)]
        CONTACTS[CRM Data] --> PG
        ANALYTICS[Analytics] --> PG
    end

    subgraph "Cache Layer"
        SESSIONS[Sessions] --> REDIS[(Redis)]
        LIMITS[Rate Limits] --> REDIS
    end

    subgraph "AI Layer"
        DOCS[Documents] --> PINECONE[(Pinecone)]
        QUERIES[Search Queries] --> PINECONE
    end

    MONGO --> ANALYTICS
    PG --> REPORTS[Reporting]
    REDIS --> PERFORMANCE[Performance]
    PINECONE --> CONTEXT[Context Retrieval]
```

---

## 🔒 Security Architecture

### Authentication & Authorization

```mermaid
graph TD
    A[User Login] --> B[Supabase Auth]
    B --> C[JWT Token Issued]
    C --> D[API Request with JWT]
    D --> E[Validate Token]
    E --> F[Extract Company Context]
    F --> G[Row Level Security]
    G --> H[Company-Scoped Data Access]

    I[Public Endpoints] --> J[API Key Validation]
    J --> K[Rate Limiting]
    K --> L[Service Access]
```

**Security Layers:**
1. **Supabase Authentication** - JWT-based auth
2. **Row Level Security** - Database-level isolation
3. **API Key Authentication** - External integrations
4. **Rate Limiting** - DDoS protection
5. **Input Validation** - Zod schemas throughout
6. **Audit Logging** - Compliance tracking

### Multi-Tenant Isolation

**Database Level:**
- All tables include `company_id` foreign keys
- RLS policies enforce company data access
- No cross-company data leakage

**Application Level:**
- JWT tokens include company context
- All queries filtered by company scope
- Service-level validation of company access

---

## 📊 Scalability Design

### Horizontal Scaling Strategy

```mermaid
graph LR
    subgraph "Load Distribution"
        LB[Load Balancer] --> SVC1[Service Instance 1]
        LB --> SVC2[Service Instance 2]
        LB --> SVC3[Service Instance 3]
    end

    subgraph "Database Scaling"
        SVC1 --> DB1[(Primary DB)]
        SVC2 --> DB1
        SVC3 --> DB2[(Read Replica)]
    end

    subgraph "Cache Strategy"
        SVC1 --> CACHE[(Redis Cluster)]
        SVC2 --> CACHE
        SVC3 --> CACHE
    end

    subgraph "External Services"
        SVC1 --> OPENAI[OpenAI API]
        SVC2 --> LIVEKIT[LiveKit RTC]
        SVC3 --> PINECONE[Pinecone]
    end
```

### Performance Optimizations

**Database Optimization:**
- Strategic indexing on frequently queried fields
- Connection pooling for database connections
- Read replicas for analytics queries
- Query optimization and prepared statements

**Caching Strategy:**
- Redis for session data and temporary caches
- Application-level caching for expensive operations
- CDN for static assets and API responses

**Real-Time Optimization:**
- WebSocket connection pooling
- Message queuing for high-throughput scenarios
- Load balancing across LiveKit servers

---

## 🚀 Deployment Architecture

### Production Infrastructure

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browsers]
        MOBILE[Mobile Apps]
    end

    subgraph "CDN Layer"
        VERCEL[Vercel Edge Network]
        CDN[Global CDN]
    end

    subgraph "Application Layer"
        FRONTEND[Next.js Frontend]
        GATEWAY[API Gateway]
    end

    subgraph "Service Layer"
        AGENT[Agent Service - Railway]
        CHAT[Chat Service - Railway]
        KNOWLEDGE[Knowledge Base - Railway]
        VOICE[Voice Agent - Railway]
    end

    subgraph "Data Layer"
        SUPABASE[Supabase PostgreSQL]
        MONGODB[MongoDB Atlas]
        REDIS[Redis Cloud]
        PINECONE[Pinecone]
    end

    subgraph "External APIs"
        OPENAI[OpenAI API]
        LIVEKIT[LiveKit Cloud]
        SENDGRID[SendGrid - Email]
    end

    WEB --> VERCEL
    MOBILE --> CDN

    VERCEL --> FRONTEND
    CDN --> GATEWAY

    FRONTEND --> GATEWAY
    GATEWAY --> AGENT
    GATEWAY --> CHAT
    GATEWAY --> KNOWLEDGE
    GATEWAY --> VOICE

    AGENT --> SUPABASE
    AGENT --> OPENAI
    CHAT --> MONGODB
    CHAT --> REDIS
    KNOWLEDGE --> PINECONE
    VOICE --> LIVEKIT
    VOICE --> SENDGRID
    VOICE --> TWILIO
```

### Service Deployment Strategy

**Frontend:** Vercel (global edge network, automatic scaling)
**Services:** Railway (managed containers, auto-scaling)
**Databases:** Managed cloud services (Supabase, MongoDB Atlas)
**External APIs:** Cloud services (OpenAI, LiveKit, etc.)

---

## 🔧 Technology Choices & Rationale

### Frontend Framework
**Next.js 16 with App Router**
- **Why:** Server components for performance, App Router for better UX
- **Benefits:** SEO optimization, fast loading, modern React patterns

### Backend Runtime
**Node.js with TypeScript**
- **Why:** JavaScript ecosystem consistency, strong typing
- **Benefits:** Developer productivity, type safety, rich ecosystem

### Voice Agent Runtime
**Python with LiveKit**
- **Why:** LiveKit's Python SDK is most mature, asyncio for real-time
- **Benefits:** Better voice processing, async performance

### Database Choices
**PostgreSQL + MongoDB + Redis**
- **Why:** Right tool for each workload type
- **Benefits:** Performance optimization, cost efficiency

### Real-Time Infrastructure
**LiveKit + Socket.io**
- **Why:** LiveKit for WebRTC, Socket.io for messaging
- **Benefits:** Production-ready, scalable architecture

### AI Integration
**OpenAI GPT-4 + Pinecone**
- **Why:** Industry standard for quality and RAG capabilities
- **Benefits:** Production reliability, advanced features

---

## 📈 Monitoring & Observability

### Application Monitoring
- **Error Tracking:** Sentry for all services
- **Performance Monitoring:** Custom metrics collection
- **API Monitoring:** Response times, error rates, throughput

### Infrastructure Monitoring
- **Service Health:** Railway deployment monitoring
- **Database Performance:** Query performance tracking
- **External API Usage:** Rate limiting and quota monitoring

### Business Metrics
- **User Engagement:** Conversation metrics, response times
- **System Performance:** Uptime, latency, error rates
- **AI Performance:** Token usage, response quality metrics

---

## 🔄 Development Workflow

### Local Development
```mermaid
graph LR
    A[Developer] --> B[pnpm install]
    B --> C[cp .env.example .env.local]
    C --> D[Configure services]
    D --> E[pnpm run dev:all]
    E --> F[All services running locally]
```

### CI/CD Pipeline
```mermaid
graph LR
    A[Git Push] --> B[GitHub Actions]
    B --> C[Run Tests]
    C --> D[Build Services]
    D --> E[Deploy to Railway]
    E --> F[Deploy Frontend to Vercel]
    F --> G[Run Integration Tests]
```

### Environment Management
- **Local:** All services run via Docker Compose
- **Development:** Shared development environment
- **Staging:** Production-like environment for testing
- **Production:** Fully managed cloud infrastructure

---

This architecture enables Syntera to deliver scalable conversational AI while maintaining flexibility to scale and evolve.
