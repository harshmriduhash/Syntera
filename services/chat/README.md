# 💬 Chat Service

**Real-time messaging and conversation management engine.**

## Overview

The Chat Service handles all real-time communication in Syntera, managing WebSocket connections, message persistence, conversation threading, and real-time updates across multiple channels.

**Port**: 4004  
**Technology**: Node.js, Express, Socket.io, TypeScript  
**Database**: MongoDB (conversations) + Redis (caching)

## Core Responsibilities

### 🌐 Real-time Communication
- **WebSocket connections** - Bidirectional real-time messaging
- **Connection pooling** - Efficient handling of multiple clients
- **Presence indicators** - Online/offline status tracking
- **Typing indicators** - Real-time typing feedback

### 💾 Message Persistence
- **Conversation storage** - Complete message history in MongoDB
- **Thread management** - Conversation branching and organization
- **Attachment handling** - File uploads and storage integration
- **Message metadata** - Timestamps, sender info, message types

### 🔄 Conversation Management
- **Multi-channel support** - Chat, voice, email conversation types
- **Participant management** - Add/remove conversation members
- **Status tracking** - Active, archived, completed conversations
- **Search and filtering** - Message and conversation discovery

### 🔐 Authentication & Security
- **Socket authentication** - JWT-based secure connections
- **Rate limiting** - Message spam prevention (500 req/15min)
- **Input validation** - XSS and injection protection
- **Audit trails** - Message activity logging

## API Endpoints

### Conversation Management
```
GET    /api/conversations           # List user conversations
POST   /api/conversations           # Create new conversation
GET    /api/conversations/:id       # Get conversation details
PUT    /api/conversations/:id       # Update conversation
DELETE /api/conversations/:id       # Delete conversation
```

### Message Operations
```
GET    /api/conversations/:id/messages       # Get conversation messages
POST   /api/conversations/:id/messages       # Send new message
PATCH  /api/conversations/:id/messages/:mid  # Edit message
DELETE /api/conversations/:id/messages/:mid  # Delete message
```

### Thread Management
```
POST   /api/conversations/:id/threads         # Create conversation thread
GET    /api/conversations/:id/threads/:tid   # Get thread messages
POST   /api/conversations/:id/threads/:tid   # Add message to thread
```

### Real-time Events (WebSocket)

#### Client → Server Events
```
conversation:join     # Join conversation room
conversation:leave    # Leave conversation room
message:send          # Send new message
typing                # Show typing indicator
thread:create         # Create new thread
thread:switch         # Switch between threads
```

#### Server → Client Events
```
message:new           # New message received
message:edited        # Message was edited
message:deleted       # Message was deleted
user:typing           # User started/stopped typing
user:joined           # User joined conversation
user:left             # User left conversation
thread:created        # New thread created
```

## Architecture

### Service Structure
```
src/
├── config/           # Database and service configuration
├── handlers/         # WebSocket event handlers
│   ├── messages.ts   # Message sending logic
│   ├── conversations.ts # Room management
│   └── threads.ts    # Thread operations
├── middleware/       # Express and Socket middleware
│   └── auth.ts       # JWT authentication
├── models/           # Data models (MongoDB schemas)
├── routes/           # REST API endpoints
│   ├── conversations.ts # Conversation CRUD
│   └── internal.ts   # Background operations
└── utils/            # Helper functions
```

### Key Components

#### Socket.io Integration
```typescript
// Real-time bidirectional communication
io.on('connection', (socket: AuthenticatedSocket) => {
  // Join conversation room
  socket.on('conversation:join', (conversationId) => {
    socket.join(`conversation:${conversationId}`)
  })

  // Handle message sending
  socket.on('message:send', async (data) => {
    await handleSendMessage(io, socket, data)
  })
})
```

#### Message Persistence
```typescript
// MongoDB message storage with indexing
const messageSchema = new Schema({
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderType: { type: String, enum: ['user', 'agent'], required: true },
  content: { type: String, required: true },
  messageType: { type: String, enum: ['text', 'file', 'system'], default: 'text' },
  metadata: { type: Map, of: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true }
})
```

#### Authentication Middleware
```typescript
// JWT-based socket authentication
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
) {
  try {
    const token = socket.handshake.auth.token
    const payload = verifyJWT(token)
    socket.user = payload
    next()
  } catch (error) {
    next(new Error('Authentication failed'))
  }
}
```

## Data Flow

### Message Processing
1. **Client connects** → Socket authentication via JWT
2. **Join conversation** → Client subscribes to conversation room
3. **Send message** → Message validated and stored in MongoDB
4. **Broadcast event** → All room participants receive message
5. **Agent notification** → Agent service triggered for AI response

### Conversation Lifecycle
1. **Creation** → New conversation document in MongoDB
2. **Participant joining** → Socket room subscription
3. **Real-time messaging** → Bidirectional WebSocket events
4. **Thread creation** → Message branching within conversation
5. **Archival** → Conversation status updates for history

### Thread Management
1. **Thread creation** → New thread document linked to conversation
2. **Message branching** → Messages can belong to threads or main conversation
3. **Thread switching** → Clients can navigate between threads
4. **Thread persistence** → Thread hierarchy maintained in database

## Configuration

### Environment Variables
```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017/syntera

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret

# Socket.io
SOCKET_CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# External Services
CHAT_SERVICE_URL=http://localhost:4004
AGENT_SERVICE_URL=http://localhost:4002
```

## Development

### Local Setup
```bash
cd services/chat
pnpm install
pnpm dev
```

### Testing WebSocket Connections
```bash
# Health check
curl http://localhost:4004/health

# Test Socket.io connection
# Use browser console or tools like Socket.io Client Tool
# Connect to ws://localhost:4004 with JWT auth
```

### Key Development Patterns

#### Socket Event Handling
```typescript
// Typed socket events for type safety
socket.on('message:send', async (data: SendMessageData) => {
  try {
    const message = await saveMessageToDB(data)
    io.to(`conversation:${data.conversationId}`).emit('message:new', message)
  } catch (error) {
    socket.emit('error', { message: 'Failed to send message' })
  }
})
```

#### Database Operations
```typescript
// MongoDB aggregation for conversation queries
const conversations = await Conversation.aggregate([
  { $match: { participants: userId } },
  { $lookup: {
    from: 'messages',
    localField: '_id',
    foreignField: 'conversationId',
    as: 'lastMessage'
  }},
  { $sort: { 'lastMessage.createdAt': -1 } }
])
```

#### Error Handling
```typescript
// Graceful error handling in socket events
socket.on('message:send', async (data) => {
  try {
    await processMessage(data)
  } catch (error) {
    logger.error('Message processing failed', { error, data })
    socket.emit('message:error', {
      messageId: data.tempId,
      error: 'Message could not be sent'
    })
  }
})
```

## Monitoring & Debugging

### Health Checks
- **GET /health** - Service availability and database connectivity
- **Socket connection monitoring** - Active connections and rooms
- **Message throughput** - Messages per second metrics

### Logging
- **Connection events** - Socket connect/disconnect logging
- **Message activity** - All message operations logged
- **Error tracking** - Failed operations and exceptions
- **Performance metrics** - Response times and throughput

### Common Issues
- **Socket authentication failures** - JWT token validation issues
- **Message delivery failures** - Database connectivity problems
- **Rate limiting triggers** - Client spam detection
- **Connection drops** - Network issues or server restarts

## Performance Optimization

### Connection Management
- **Room-based messaging** - Targeted broadcasts instead of global
- **Connection pooling** - Efficient WebSocket connection handling
- **Memory management** - Automatic cleanup of inactive connections
- **Load balancing** - Horizontal scaling support

### Database Optimization
- **Indexing strategy** - Optimized queries for conversation and message lookups
- **Pagination** - Efficient message history loading
- **Caching layer** - Redis for frequently accessed conversation data
- **Archive strategy** - Old conversation data management

### Real-time Efficiency
- **Event batching** - Group related events to reduce network overhead
- **Selective broadcasting** - Only send relevant events to connected clients
- **Connection limits** - Prevent server overload from too many connections
- **Message compression** - Reduce bandwidth usage for large messages

## Security Measures

- **JWT authentication** - Secure WebSocket connections
- **Rate limiting** - Message spam and abuse prevention
- **Input sanitization** - XSS and injection attack protection
- **Audit logging** - All message operations tracked
- **Connection monitoring** - Suspicious activity detection
- **Data encryption** - Secure message storage and transmission

## Dependencies

### Core Dependencies
- **socket.io** - Real-time bidirectional communication
- **mongoose** - MongoDB object modeling
- **ioredis** - Redis client for caching
- **jsonwebtoken** - JWT authentication
- **express** - HTTP server framework
- **winston** - Structured logging

### Development Dependencies
- **typescript** - Type safety
- **tsx** - Development server
- **socket.io-client** - Testing utilities

---

**The real-time communication backbone that powers Syntera's conversational experience.**
