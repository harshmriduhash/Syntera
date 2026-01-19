# Contributing to Syntera

**Guidelines for contributing to the Syntera conversational AI platform**

We welcome contributions from the community! This guide outlines the standards, processes, and best practices for contributing to Syntera.

---

## 🚀 Getting Started

### Prerequisites

```bash
# Required software
Node.js 18+                    # Frontend & API services
Python 3.10+                   # Voice agent service
pnpm                           # Package manager
Docker & Docker Compose        # Local development
Git                            # Version control
```

### Development Environment Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/harshmriduhash/syntera.git
cd syntera
```

#### 2. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install

# Verify installation
pnpm run build:all
```

#### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env.local

# Configure required services (see docs/DEPLOYMENT.md)
# - Supabase (database & auth)
# - OpenAI API key
# - LiveKit credentials
# - Other service APIs
```

#### 4. Start Development Services

```bash
# Start all services locally
pnpm run dev:all

# Or start individual services:
pnpm run dev:frontend     # http://localhost:3000
pnpm run dev:agent        # http://localhost:4002
pnpm run dev:chat         # http://localhost:4004
pnpm run dev:kb           # http://localhost:4005
pnpm run dev:voice-agent  # http://localhost:4008
```

#### 5. Verify Setup

```bash
# Run health checks
curl http://localhost:3000/api/health
curl http://localhost:4002/health
curl http://localhost:4004/health
curl http://localhost:4005/health
curl http://localhost:4008/health
```

---

## 📝 Development Standards

### Code Style & Formatting

#### TypeScript/JavaScript Standards

**ESLint Configuration**: Basic Next.js ESLint setup with TypeScript support.

**Basic Rules**:

- TypeScript compilation errors must be resolved
- No unused variables in committed code
- Consistent code formatting (Prettier recommended)

#### Python Standards

**Voice Agent Code Style:**

```python
# Use type hints
def process_message(message: str, context: dict) -> dict:
    """Process incoming message with context.

    Args:
        message: The incoming message text
        context: Additional context information

    Returns:
        Processing result dictionary
    """
    pass
```

**Standards:**

- Type hints for all function parameters and return values
- Google-style docstrings
- Black code formatter (line length: 88 characters)
- isort for import sorting

### Naming Conventions

#### Files & Directories

```
📁 services/agent/src/routes/
├── agents.ts          # Resource name (plural)
├── responses.ts       # Action/feature name
├── livekit.ts         # External service integration

📁 frontend/components/
├── ui/button.tsx      # Generic UI components
├── dashboard/         # Feature-specific components
└── shared/            # Shared utilities
```

#### Variables & Functions

```typescript
// ✅ Good naming
const userProfile = { ... };
const isAuthenticated = true;
function fetchUserConversations(userId: string) { ... }
function validateAgentConfig(config: AgentConfig) { ... }

// ❌ Avoid
const u = { ... };
const auth = true;
function getData(id) { ... }
function check(config) { ... }
```

### Commit Message Conventions

#### Format

```
type(scope): description

[optional body]

[optional footer]
```

#### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

#### Examples

```bash
# ✅ Good commit messages
feat(agent): add voice settings configuration
fix(api): resolve conversation pagination bug
docs(security): add GDPR compliance guidelines
refactor(auth): simplify JWT validation logic

# ❌ Avoid
fix bug
update code
changes
```

---

## 🧪 Testing Standards

### Testing (Not Currently Implemented)

**Current State**: No formal test suite implemented yet.

**Future Plans**:

- Unit tests for business logic functions
- Integration tests for API endpoints
- Load testing for performance validation
- Manual testing for critical user flows

---

## 🔄 Git Workflow

### Branch Naming

```
feature/add-voice-settings
fix/conversation-pagination
docs/api-reference
refactor/agent-service
```

### Pull Request Process

#### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

#### 2. Make Changes

- Write tests for new functionality
- Update documentation if needed
- Ensure all tests pass

#### 3. Commit Changes

```bash
git add .
git commit -m "feat: add voice settings to agent configuration

- Add voice selection dropdown
- Support multiple voice providers
- Update agent schema validation

Closes #123"
```

#### 4. Push & Create PR

```bash
git push origin feature/your-feature-name
# Create pull request on GitHub
```

### Pull Request Guidelines

**Include in PR description:**

- Clear description of changes made
- Any breaking changes or migrations needed
- Testing approach used
- Related issues or feature requests

---

## 🔍 Code Review Process

### Basic Review Checklist

- Code compiles without TypeScript errors
- No obvious security issues
- Basic functionality testing completed
- Documentation updated for API changes

---

## 📋 Development Best Practices

### API Design

#### RESTful Conventions

```typescript
// ✅ Good API design
GET    /api/agents           // List agents
POST   /api/agents           // Create agent
GET    /api/agents/:id       // Get specific agent
PATCH  /api/agents/:id       // Update agent
DELETE /api/agents/:id       // Delete agent

// Resource relationships
GET    /api/conversations/:id/messages  // Conversation messages
GET    /api/agents/:id/conversations    // Agent conversations
```

#### Error Handling

```typescript
// Standardized error responses
interface ApiError {
  error: string;
  code: string;
  details?: any;
}

// HTTP status codes
200: Success
201: Created
400: Bad Request
401: Unauthorized
403: Forbidden
404: Not Found
429: Rate Limited
500: Internal Server Error
```

### Database Practices

#### Schema Design

```sql
-- ✅ Good practices
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  status VARCHAR(20) CHECK (status IN ('active', 'ended', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_conversations_company_status ON conversations(company_id, status);
CREATE INDEX idx_conversations_agent ON conversations(agent_id);
```

#### Migration Scripts

```typescript
// migration file naming: V1__create_agents_table.sql
-- Up migration
CREATE TABLE agents (...);

-- Down migration
DROP TABLE agents;
```

### Security Practices

#### Input Validation

```typescript
// Use Zod for runtime validation
import { z } from "zod";

const AgentSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  model: z.enum(["gpt-4o-mini", "gpt-4-turbo"]),
  temperature: z.number().min(0).max(2),
  system_prompt: z.string().max(10000),
});

export function validateAgent(data: unknown) {
  return AgentSchema.parse(data);
}
```

#### Authentication Checks

```typescript
// Always verify user context
export async function requireCompany(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user?.company_id) {
    return res.status(403).json({ error: "Company access required" });
  }
  next();
}
```

---

## 🐛 Issue Reporting

### Bug Reports

**Please include:**

- Clear title describing the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, Node version)
- Screenshots or error messages
- Related code or configuration

### Feature Requests

**Please include:**

- Clear description of the feature
- Use case and business value
- Proposed implementation approach
- Alternative solutions considered
- Mockups or examples if applicable

### Issue Types

- Bug reports with reproduction steps
- Feature requests with use case description
- Documentation improvements
- Security concerns

---

## 📜 License & Legal

### Contributor License Agreement

By contributing to Syntera, you agree that your contributions will be licensed under the same license as the project (GNU General Public License v3.0).

---

## 🎯 Getting Help

### Communication Channels

**GitHub Issues:** Bug reports and feature requests
**GitHub Discussions:** General questions and community discussion
**Email:** For security issues or sensitive matters

### Resources

- **Documentation:** See `/docs` directory
- **API Reference:** `docs/API.md`
- **Architecture Guide:** `docs/ARCHITECTURE.md`
- **Deployment Guide:** `docs/DEPLOYMENT.md`

---

## 🙏 Recognition

Contributors will be recognized in:

- Repository contributor statistics
- Release notes for significant contributions
- Special mentions for outstanding contributions

Thank you for contributing to Syntera! Your efforts help make conversational AI more accessible and reliable for businesses worldwide.

---

**Ready to contribute? Start by exploring the codebase and creating your first issue or pull request!** 🚀
