# Syntera Security Overview

**Basic security measures for conversational AI platforms**

This document outlines Syntera's implemented security measures and data protection practices.

---

## 🔐 Security Architecture

### Authentication & Authorization

#### Supabase Authentication
```typescript
// JWT-based authentication
interface AuthContext {
  user: {
    id: string;
    email: string;
    company_id: string;
    role: 'owner' | 'admin' | 'user';
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}
```

**Implemented Features:**
- **JWT Tokens** with expiration
- **Refresh Token Support**
- **Role-Based Access Control** (owner/admin/user)

#### Role-Based Access Control
Three-tier permission system: owner (full access), admin (manage resources), user (view/interact with assigned resources).

### Data Isolation & Privacy

#### Row Level Security (RLS)
```sql
-- Tenant isolation at database level
ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_agent_access" ON agent_configs
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));
```

**Isolation Levels:**
- **Company Level**: Complete data separation between tenants
- **User Level**: Basic permissions within companies

#### Data Encryption

**In Transit:**
- **TLS 1.3** for all API communications (Railway/Vercel)
- **Secure WebSocket** connections (WSS) for LiveKit

---

## 🛡️ Compliance Standards

### Basic Data Protection

#### Implemented Measures
- **Data Isolation**: Company-level data separation via Row Level Security
- **Access Controls**: Role-based permissions (owner/admin/user)
- **Basic Logging**: Supabase provides authentication logs

#### Current Limitations
- No automated GDPR export/deletion endpoints
- Manual data management for compliance requests
- Basic audit logging only

### Security Standards

#### Implemented Controls
- **Authentication**: JWT-based auth with Supabase
- **Authorization**: Row Level Security for data isolation
- **Encryption**: TLS for data in transit
- **Monitoring**: Sentry error tracking and logging

---

## 🔒 Security Controls

### Input Validation & Sanitization

#### API Input Validation
```typescript
// Zod schemas for comprehensive validation
import { z } from 'zod';

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(100),
  system_prompt: z.string().min(10).max(10000),
  model: z.enum(['gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']),
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().min(1).max(4000),
  voice_settings: z.object({
    voice: z.string().optional(),
    language: z.string().optional()
  }).optional()
});
```

**Validation Layers:**
- **Schema Validation**: Type-safe input validation
- **Basic Sanitization**: XSS and SQL injection prevention

### API Security

#### Authentication Middleware
```typescript
// JWT authentication middleware
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    const payload = verifyJWT(token);

    // Validate token expiration
    if (payload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    // Attach user context
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

#### Rate Limiting
```typescript
// Basic rate limiting
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later' }
});
```

### Monitoring

#### Basic Error Tracking
- **Sentry**: Captures application errors
- **Supabase Logs**: Basic authentication logging
- **Railway Logs**: Service-level logging for debugging

---

## 🔐 Data Protection

### Data Classification
- **Public**: Marketing content, general documentation
- **Internal**: Business metrics, operational data
- **Confidential**: Customer conversations, contact information

### Backup Strategy
Railway-managed backups for PostgreSQL, MongoDB, and Redis databases.

---

## 🛠️ Security Best Practices

### Development Security
- Use environment variables for secrets
- Validate all user inputs with Zod schemas
- Implement proper error handling without exposing sensitive data
- Regular dependency updates and security scans

### Operational Security
- Monitor error rates and unusual access patterns
- Regular backup verification
- Secure API key management
- Log analysis for security events

---

## 📋 Security Best Practices

### Development Security
- Use environment variables for secrets
- Validate all user inputs with Zod schemas
- Implement proper error handling without exposing sensitive data
- Regular dependency updates and security scans

### Operational Security
- Monitor error rates and unusual access patterns
- Regular backup verification
- Secure API key management
- Log analysis for security events

---