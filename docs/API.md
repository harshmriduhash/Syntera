# Syntera API Reference

**Complete API Documentation**

This document provides comprehensive API documentation for the Syntera platform, covering all microservices and frontend API endpoints.

## 🔐 Authentication

All API endpoints require authentication. Syntera uses Supabase Auth with JWT tokens.

### Headers Required:
```
Authorization: Bearer <supabase-jwt-token>
Content-Type: application/json
```

### Company Context:
All endpoints are scoped to the authenticated user's company via Row Level Security.

---

## 🤖 Agent Management APIs

### Create Agent
```http
POST /api/agents
```

**Request Body:**
```json
{
  "name": "Customer Support Agent",
  "description": "Handles customer inquiries",
  "system_prompt": "You are a helpful customer support agent...",
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "max_tokens": 2000,
  "enabled": true,
  "voice_settings": {
    "voice": "alloy",
    "language": "en"
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Customer Support Agent",
  "company_id": "uuid",
  "enabled": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### List Company Agents
```http
GET /api/agents
```

**Response:**
```json
{
  "agents": [
    {
      "id": "uuid",
      "name": "Sales Agent",
      "description": "Handles sales inquiries",
      "model": "gpt-4-turbo",
      "enabled": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Update Agent
```http
PATCH /api/agents/:id
```

**Request Body:** (partial updates supported)
```json
{
  "name": "Updated Agent Name",
  "enabled": false
}
```

### Delete Agent
```http
DELETE /api/agents/:id
```

---

## 💬 Conversation APIs

### List Conversations
```http
GET /api/conversations?limit=20&offset=0&status=ended
```

**Query Parameters:**
- `limit`: Number of conversations (default: 20, max: 50)
- `offset`: Pagination offset (default: 0)
- `status`: Filter by status (`active`, `ended`, `archived`)

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "agent_id": "uuid",
      "channel": "chat",
      "status": "ended",
      "started_at": "2024-01-01T00:00:00Z",
      "ended_at": "2024-01-01T00:05:00Z",
      "contact_id": "uuid",
      "metadata": {
        "source": "website",
        "ip_address": "192.168.1.1"
      }
    }
  ],
  "total": 150
}
```

### Get Conversation Messages
```http
GET /api/conversations/:id/messages
```

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "sender_type": "user",
      "content": "Hello, I need help",
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "conversation_id": "uuid",
      "sender_type": "agent",
      "content": "I'd be happy to help you!",
      "ai_metadata": {
        "model": "gpt-4o-mini",
        "tokens_used": 150
      },
      "created_at": "2024-01-01T00:00:01Z"
    }
  ]
}
```

### Send Message
```http
POST /api/conversations/:id/messages
```

**Request Body:**
```json
{
  "content": "User message here",
  "attachments": [
    {
      "url": "https://example.com/file.pdf",
      "type": "application/pdf",
      "name": "document.pdf",
      "size": 1024000
    }
  ]
}
```

---

## 📊 Analytics APIs

### Overview Metrics
```http
GET /api/analytics/overview?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "totalConversations": 1250,
  "activeConversations": 45,
  "activeAgents": 8,
  "avgResponseTime": 850,
  "userSatisfaction": 4.2
}
```

### Conversation Analytics
```http
GET /api/analytics/conversations?startDate=2024-01-01&endDate=2024-01-31&groupBy=day
```

**Response:**
```json
{
  "timeline": [
    {
      "date": "2024-01-01",
      "count": 45
    }
  ],
  "byChannel": [
    {
      "channel": "chat",
      "count": 800
    },
    {
      "channel": "voice",
      "count": 200
    }
  ],
  "avgDuration": 420
}
```

### Cost Analytics
```http
GET /api/analytics/costs?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "totalTokens": 1500000,
  "estimatedCost": 2.25
}
```

### Agent Performance
```http
GET /api/analytics/agents?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "agents": [
    {
      "agentId": "uuid",
      "agentName": "Support Agent",
      "conversationCount": 150,
      "avgResponseTime": 780,
      "satisfaction": 4.1
    }
  ]
}
```

---

## 👥 CRM APIs

### List Contacts
```http
GET /api/crm/contacts?limit=20&offset=0&search=john
```

**Response:**
```json
{
  "contacts": [
    {
      "id": "uuid",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "company_name": "Acme Corp",
      "tags": ["lead"],
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 250
}
```

### Create Contact
```http
POST /api/crm/contacts
```

**Request Body:**
```json
{
  "email": "jane@example.com",
  "first_name": "Jane",
  "last_name": "Smith",
  "company_name": "Tech Corp",
  "tags": ["prospect"]
}
```

### List Deals
```http
GET /api/crm/deals?stage=qualified&limit=20
```

**Response:**
```json
{
  "deals": [
    {
      "id": "uuid",
      "title": "License",
      "value": 50000,
      "stage": "proposal",
      "probability": 75,
      "contact_id": "uuid",
      "expected_close_date": "2024-02-01"
    }
  ],
  "total": 45 
}
```

---

## 📚 Knowledge Base APIs

### Upload Document
```http
POST /api/knowledge-base/upload
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: PDF, DOCX, or TXT file
- `title`: Document title
- `description`: Optional description

**Response:**
```json
{
  "id": "uuid",
  "title": "Product Documentation",
  "status": "processing",
  "chunk_count": 150,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Search Knowledge Base
```http
POST /api/knowledge-base/search
```

**Request Body:**
```json
{
  "query": "refund policy",
  "limit": 5,
  "threshold": 0.7
}
```

**Response:**
```json
{
  "results": [
    {
      "document_id": "uuid",
      "chunk_id": "uuid",
      "content": "Our refund policy allows...",
      "score": 0.85,
      "metadata": {
        "source": "policy.pdf",
        "page": 12
      }
    }
  ]
}
```

### List Documents
```http
GET /api/knowledge-base
```

**Response:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "User Guide",
      "description": "Complete user manual",
      "status": "processed",
      "chunk_count": 200,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## 🔄 Workflow APIs

### List Workflows
```http
GET /api/workflows
```

**Response:**
```json
{
  "workflows": [
    {
      "id": "uuid",
      "name": "Lead Qualification",
      "description": "Automatically qualify and route leads",
      "enabled": true,
      "trigger_type": "conversation_started",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Workflow
```http
POST /api/workflows
```

**Request Body:**
```json
{
  "name": "Support Escalation",
  "description": "Escalate urgent issues",
  "trigger_type": "message_received",
  "trigger_config": {
    "keywords": ["urgent", "emergency"]
  },
  "nodes": [...],
  "edges": [...]
}
```

### Test Workflow
```http
POST /api/workflows/:id/test
```

**Request Body:**
```json
{
  "testData": {
    "message": "This is urgent!",
    "conversation_id": "uuid"
  }
}
```

### Get Workflow Executions
```http
GET /api/workflows/:id/executions?limit=10
```

**Response:**
```json
{
  "executions": [
    {
      "id": "uuid",
      "status": "success",
      "triggered_by": "message_received",
      "execution_time_ms": 150,
      "executed_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## 🔔 Notification APIs

### Get Notifications
```http
GET /api/notifications?limit=20&read=false
```

### Mark as Read
```http
POST /api/notifications/:id/read
```

### Mark All as Read
```http
POST /api/notifications/read-all
```

### Get Unread Count
```http
GET /api/notifications/unread-count
```

---

## 🌐 Public APIs

### External Agent Access
```http
GET /public/agents/:id
POST /public/conversations
POST /public/conversations/:id/messages
```

### LiveKit Integration
```http
GET /public/livekit/token
```

### Voice Bot Deployment
```http
POST /public/voice-bot/deploy
```

---

## ⚠️ Error Handling

All APIs return standardized error responses:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common HTTP Status Codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Rate Limited
- `500`: Internal Server Error

### Rate Limiting:
- 1000 requests per hour per user
- Rate limit headers included in responses

---

## 🔒 Security & Compliance

- **Row Level Security**: All data scoped to company
- **JWT Authentication**: Bearer token required
- **Input Validation**: Zod schemas on all endpoints
- **GDPR Compliance**: Data export and deletion capabilities
- **Audit Logging**: All API calls logged for compliance

---

## 📞 Support

For API integration questions or issues:
- Check the error response details
- Review the request/response examples above
- Test with the live demo at https://syntera-tau.vercel.app/