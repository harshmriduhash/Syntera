# Syntera Deployment Guide

**Production deployment instructions**

This guide covers complete deployment of Syntera from development to production, including all microservices, databases, and external integrations.

---

## 🏗️ Architecture Overview

### Production Stack
- **Frontend**: Vercel (Next.js with global CDN)
- **Services**: Railway (Docker containers with managed databases)
- **Database**: Supabase (PostgreSQL) + Railway MongoDB
- **Cache**: Railway Redis
- **Vector DB**: Pinecone
- **Real-time**: LiveKit Cloud

### Infrastructure Diagram
```
┌─────────────────┐    ┌─────────────────┐
│   Vercel Edge   │    │   Railway       │
│   (Frontend)    │◄──►│   (Services)    │
│                 │    │                 │
│ • Next.js 16    │    │ • Agent Service │
│ • Global CDN    │    │ • Chat Service  │
│ • SSL/TLS       │    │ • KB Service    │
└─────────────────┘    │ • Voice Service │
                       └─────────────────┘
                              │
                              ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Supabase      │    │   Railway       │    │   Pinecone      │
│   PostgreSQL    │    │   MongoDB       │    │   Vector DB     │
│                 │    │                 │    │                 │
│ • Business Data │    │ • Conversations │    │ • Embeddings    │
│ • CRM           │    │ • Messages      │    │ • RAG Context   │
│ • Multi-tenant  │    │ • High Volume   │    │ • Fast Search   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
┌─────────────────┐
│   Railway       │
│   Redis         │
│                 │
│ • Caching       │
│ • Sessions      │
│ • Rate Limiting │
└─────────────────┘

External APIs: OpenAI, LiveKit, SendGrid, Twilio
```

---

## 🚀 Quick Start (Development)

### Prerequisites
```bash
# Required tools
Node.js 18+          # Frontend & services
Python 3.10+         # Voice agent
pnpm                # Package manager
Docker              # Local databases
```

### 1. Clone Repository
```bash
git clone https://github.com/harshmriduhash/syntera.git
cd syntera
```

### 2. Install Dependencies
```bash
# Install all workspace dependencies
pnpm install

# Verify installations
pnpm run build:all
```

### 3. Environment Setup
```bash
# Copy environment template
cp .env.example .env.local

# Edit with your API keys (see Environment Variables section below)
nano .env.local
```

### 4. Start Development Environment
```bash
# Start all services locally
pnpm run dev:all

# Or start individually:
pnpm run dev:frontend     # http://localhost:3000
pnpm run dev:agent        # http://localhost:4002
pnpm run dev:chat         # http://localhost:4004
pnpm run dev:kb           # http://localhost:4005
pnpm run dev:voice-agent  # http://localhost:4008
```

### 5. Verify Installation
```bash
# Check all services are running
curl http://localhost:3000/api/health
curl http://localhost:4002/health
curl http://localhost:4004/health
curl http://localhost:4005/health
curl http://localhost:4008/health
```

---

## ⚙️ Environment Configuration

### Required Environment Variables

#### Supabase (Database & Auth)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

#### OpenAI (AI Models)
```bash
OPENAI_API_KEY=sk-your-openai-key
```

#### LiveKit (Real-time Voice/Video)
```bash
LIVEKIT_URL=https://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret
```

#### MongoDB (Conversations) - Provided by Railway
```bash
# Railway automatically provides MongoDB
# URI available in Railway environment variables
MONGODB_URI=${{MongoDB.MONGODB_URL}}
```

#### Redis (Caching) - Provided by Railway
```bash
# Railway automatically provides Redis
# URL available in Railway environment variables
REDIS_URL=${{Redis.REDIS_URL}}
```

#### Pinecone (Vector Search)
```bash
PINECONE_API_KEY=your-pinecone-key
PINECONE_INDEX_NAME=syntera-docs
```

#### SendGrid (Email)
```bash
SENDGRID_API_KEY=your-sendgrid-key
```


---

## 🏭 Production Deployment

### Frontend Deployment (Vercel)

#### 1. Connect Repository
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link project
vercel link
```

#### 2. Configure Build Settings
```json
// vercel.json (already configured)
{
  "buildCommand": "cd .. && pnpm --filter @syntera/shared build && cd frontend && pnpm build",
  "outputDirectory": ".next",
  "installCommand": "cd .. && pnpm install --frozen-lockfile",
  "framework": "nextjs"
}
```

#### 3. Set Environment Variables
```bash
# In Vercel dashboard or CLI
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add NEXT_PUBLIC_LIVEKIT_URL
# ... add all required variables
```

#### 4. Deploy
```bash
vercel --prod
```

### Backend Services Deployment (Railway)

#### 1. Create Railway Project
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init
```

#### 2. Deploy Each Service
```bash
# Agent Service
cd services/agent
railway up

# Chat Service
cd ../chat
railway up

# Knowledge Base Service
cd ../knowledge-base
railway up

# Voice Agent Service
cd ../voice-agent
railway up
```

#### 3. Configure Environment Variables
```bash
# Set environment variables for each service
railway variables set OPENAI_API_KEY=your-key
railway variables set MONGODB_URI=your-uri
# ... configure all services
```

### Database Setup

#### Supabase (PostgreSQL)
```sql
-- Create project at https://supabase.com
-- Run migrations
psql -h your-host -U postgres -d postgres -f database/supabase/migrations/*.sql
```

#### MongoDB (Railway Managed)
```bash
# Railway automatically provisions MongoDB
# Database and collections created automatically
# Connection URI provided via environment variables
```

#### Redis (Railway Managed)
```bash
# Railway automatically provisions Redis
# Connection URL provided via environment variables
# No manual setup required
```

#### Pinecone
```bash
# Create project at https://pinecone.io
# Create index with 1536 dimensions (OpenAI embeddings)
# Configure API key
```

---

## 🔧 External Service Configuration

### LiveKit Setup
```bash
# 1. Create project at https://livekit.io
# 2. Get API keys
# 3. Configure TURN servers (optional)
# 4. Set up webhooks for events (optional)
```

### OpenAI Configuration
```bash
# 1. Get API key from https://platform.openai.com
# 2. Set usage limits and billing
# 3. Configure model access (GPT-4, GPT-3.5-turbo)
```

### Email/SMS Setup (Optional)
```bash
# SendGrid for email
# 1. Create account at https://sendgrid.com
# 2. Verify domain
# 3. Create API key

```

---

## 📊 Monitoring & Health Checks

### Health Check Endpoints
```bash
# Frontend
curl https://your-domain.vercel.app/api/health

# Agent Service
curl https://your-service.railway.app/health

# Chat Service
curl https://chat-service.railway.app/health

# Knowledge Base
curl https://kb-service.railway.app/health

# Voice Agent
curl https://voice-service.railway.app/health
```

### Monitoring Setup

#### Sentry (Error Tracking)
```bash
# 1. Create project at https://sentry.io
# 2. Install SDKs in each service
# 3. Configure DSNs
# 4. Set up alerts
```

#### Railway Monitoring
```bash
# Built-in metrics available in Railway dashboard:
# - CPU usage
# - Memory usage
# - Response times
# - Error rates
# - Logs
```

#### Database Monitoring
```bash
# Supabase: Built-in dashboard
# MongoDB Atlas: Monitoring tab
# Redis Cloud: Analytics dashboard
```

---

## 🔧 Troubleshooting

### Common Issues

#### Frontend Build Fails
```bash
# Clear cache and rebuild
rm -rf .next
pnpm run build

# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
```

#### Service Won't Start
```bash
# Check environment variables
railway variables list

# Check logs
railway logs

# Verify database connections
railway run node -e "console.log('DB test')"
```

#### Database Connection Issues
```bash
# Test Supabase connection
psql -h your-host -U postgres -d postgres -c "SELECT 1"

# Test MongoDB connection
mongosh "your-connection-string" --eval "db.runCommand({ping: 1})"
```

#### LiveKit Audio/Video Issues
```bash
# Check TURN server configuration
# Verify SSL certificates
# Test WebRTC connectivity
# Check firewall settings
```

#### OpenAI API Errors
```bash
# Check API key validity
# Verify usage limits
# Check model availability
# Monitor rate limits
```

---

## 🚀 Scaling & Performance

### Frontend Scaling (Vercel)
- **Automatic scaling** based on traffic
- **Global CDN** for low latency
- **Edge functions** for dynamic content

### Service Scaling (Railway)
```bash
# Configure scaling in Railway dashboard
# Set CPU/memory limits
# Configure auto-scaling rules
# Monitor performance metrics
```

### Database Scaling (Railway Managed)
```bash
# Railway handles scaling automatically:
# PostgreSQL: Built-in connection pooling and optimization
# MongoDB: Automatic scaling based on usage
# Redis: Cluster configuration and persistence
# Pinecone: Index scaling for vector operations
```

### Load Testing
```bash
# Use tools like Artillery or k6
# Test concurrent user scenarios
# Monitor response times
# Identify bottlenecks
```

---

## 🔒 Security Checklist

### Pre-Deployment
- [ ] Environment variables configured securely
- [ ] API keys rotated and restricted
- [ ] Database passwords strong and rotated
- [ ] SSL/TLS certificates valid
- [ ] Firewall rules configured

### Authentication & Authorization
- [ ] Supabase RLS policies active
- [ ] JWT tokens properly validated
- [ ] API rate limiting configured
- [ ] CORS policies set correctly

### Data Protection
- [ ] Database backups configured
- [ ] Encryption at rest enabled
- [ ] GDPR compliance reviewed
- [ ] Data retention policies set

### Monitoring & Alerting
- [ ] Error tracking configured
- [ ] Security monitoring active
- [ ] Failed login alerts set
- [ ] Unusual activity monitoring

---

## 📞 Support & Maintenance

### Regular Maintenance Tasks

#### Weekly
- Review error logs
- Check performance metrics
- Update dependencies
- Backup verification

#### Monthly
- Security updates
- Database optimization
- Cost analysis
- User feedback review

#### Quarterly
- Architecture review
- Scalability assessment
- Technology updates
- Compliance audits

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Databases created and migrated
- [ ] External services connected
- [ ] SSL certificates valid
- [ ] Domain DNS configured

### Deployment Steps
- [ ] Deploy frontend to Vercel
- [ ] Deploy services to Railway
- [ ] Configure load balancers
- [ ] Set up monitoring
- [ ] Test all endpoints

### Post-Deployment
- [ ] Run health checks
- [ ] Test user flows
- [ ] Configure alerts
- [ ] Update documentation
- [ ] Notify stakeholders

### Go-Live Verification
- [ ] User registration works
- [ ] Agent creation functional
- [ ] Chat conversations work
- [ ] Voice calls connect
- [ ] Analytics display data
- [ ] Workflows execute properly

---

This deployment guide ensures Syntera can be reliably deployed to production with proper reliability and scalability measures.
