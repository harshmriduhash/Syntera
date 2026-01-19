# 🎤 Voice Agent Service

**Python-based real-time voice AI using LiveKit Agents.**

## Overview

The Voice Agent Service provides conversational voice AI capabilities using LiveKit's agent framework and OpenAI's Realtime API. It handles speech-to-speech interactions, manages WebRTC connections, and integrates with the broader Syntera platform.

**Port**: 4008 (HTTP API)  
**Technology**: Python, FastAPI, LiveKit Agents, OpenAI Realtime API  
**Communication**: WebRTC (LiveKit), HTTP API, Supabase

## Core Responsibilities

### 🎙️ Real-time Voice AI
- **Speech-to-speech conversations** - Natural voice interactions
- **Multi-language support** - Automatic language detection
- **Context awareness** - Conversation memory and state
- **Agent personality** - Customizable voice and behavior

### 🔗 LiveKit Integration
- **WebRTC connections** - Low-latency audio streaming
- **Room management** - Voice session coordination
- **Participant handling** - Multiple users in voice sessions
- **Session lifecycle** - Connection, streaming, disconnection

### 🤖 Agent Orchestration
- **Dynamic agent loading** - Configuration from Supabase
- **Workflow integration** - Voice-triggered automation
- **Contact extraction** - Lead capture from voice conversations
- **CRM updates** - Real-time data synchronization

### 📡 HTTP API Server
- **Agent dispatch** - Start voice sessions via API calls
- **Health monitoring** - Service status and diagnostics
- **Configuration management** - Runtime agent adjustments
- **Metrics collection** - Performance and usage analytics

## Architecture

### Service Structure
```
src/
├── main.py              # HTTP API server and service orchestration
├── agent_server.py     # LiveKit agent server (background process)
├── agent.py             # Core agent logic and conversation handling
├── config.py            # Environment configuration and validation
├── supabase_client.py   # Database integration for agent configs
├── contact_extractor.py # Lead extraction from voice conversations
├── message_saver.py     # Conversation persistence
├── utils/
│   ├── logger.py        # Structured logging
│   └── sentry.py        # Error tracking
└── requirements.txt     # Python dependencies
```

### Key Components

#### Agent Server (LiveKit)
```python
# LiveKit agent server setup
server = AgentServer()

@server.rtc_session()
async def entrypoint(ctx: JobContext):
    """Main agent entry point for voice sessions"""

    # Extract conversation metadata
    metadata = await extract_metadata(ctx)

    # Load agent configuration
    agent_config = await load_agent_config(metadata['agentId'])

    # Create voice session with OpenAI Realtime
    session = AgentSession(
        agent=Agent(
            instructions=agent_config['system_prompt'],
            voice=agent_config.get('voice', 'alloy')
        ),
        room_options=RoomOptions(close_on_disconnect=False)
    )

    # Start the voice conversation
    await session.start(room=ctx.room)
```

#### HTTP API Server (FastAPI)
```python
# Agent dispatch endpoint
@app.post("/api/agents/dispatch")
async def dispatch_agent(request: DispatchRequest):
    """Dispatch voice agent to LiveKit room"""

    # Create/update room with metadata
    room_metadata = {
        "agentId": request.agentId,
        "conversationId": request.conversationId,
        "userId": request.userId
    }

    # Add agent participant (triggers agent server)
    await lk_api.room.create_room(
        name=request.roomName,
        metadata=json.dumps(room_metadata)
    )

    return {"success": True, "message": "Agent dispatched"}
```

#### Metadata Extraction
```python
# Priority-based metadata extraction
async def extract_metadata(ctx: JobContext):
    """Extract conversation context from multiple sources"""

    # Priority: Job metadata > Room metadata > Participant metadata
    metadata = {}

    # Try job metadata first (most reliable)
    if ctx.job.metadata:
        metadata.update(json.loads(ctx.job.metadata))

    # Fall back to room metadata
    if not metadata.get('agentId') and ctx.room.metadata:
        metadata.update(json.loads(ctx.room.metadata))

    # Final fallback to participant metadata
    if not metadata.get('agentId'):
        for participant in ctx.room.participants.values():
            if participant.metadata:
                participant_data = json.loads(participant.metadata)
                if participant_data.get('agentId'):
                    metadata.update(participant_data)
                    break

    return metadata
```

## Data Flow

### Voice Session Initiation
1. **Call starts** → Frontend requests LiveKit room token
2. **Agent dispatch** → HTTP API called to add agent to room
3. **Room creation** → LiveKit room initialized with metadata
4. **Agent activation** → Agent server detects new participant
5. **Session start** → Voice conversation begins with OpenAI Realtime

### Conversation Processing
1. **Speech input** → LiveKit captures audio stream
2. **Real-time transcription** → OpenAI processes speech to text
3. **AI response generation** → GPT-4 generates contextual reply
4. **Text-to-speech** → OpenAI converts response to audio
5. **Audio streaming** → LiveKit delivers voice response

### Context Integration
1. **Metadata extraction** → Agent configuration and user context
2. **CRM data loading** → User history and preferences
3. **Workflow triggers** → Voice-activated automation rules
4. **Contact extraction** → Lead capture from conversation content
5. **Session persistence** → Conversation logging and analytics

## Configuration

### Environment Variables
```bash
# LiveKit Configuration
LIVEKIT_URL=https://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-key

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Service Configuration
API_SERVER_PORT=4008
LOG_LEVEL=INFO

# Optional: Sentry for error tracking
SENTRY_DSN=https://your-sentry-dsn
```

## Development

### Local Setup
```bash
cd services/voice-agent

# Install Python dependencies
pip install -r requirements.txt

# Run both API server and agent server
python src/main.py --mode both

# Or run separately:
python src/main.py --mode api     # HTTP API only
python src/main.py --mode agent   # Agent server only
```

### Testing Voice Agent
```bash
# Health check
curl http://localhost:4008/health

# Dispatch agent to test room
curl -X POST http://localhost:4008/api/agents/dispatch \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "test-123",
    "agentId": "agent-456",
    "userId": "user-789",
    "roomName": "test-room",
    "token": "livekit-jwt-token"
  }'
```

### Key Development Patterns

#### LiveKit Agent Pattern
```python
@server.rtc_session()
async def entrypoint(ctx: JobContext):
    """Standard LiveKit agent entry point"""

    # Always use AgentSession for proper connection handling
    session = AgentSession(agent=Agent(...))

    # Set close_on_disconnect=False for persistent sessions
    session.room_options = RoomOptions(close_on_disconnect=False)

    # Let AgentSession handle the connection
    await session.start(room=ctx.room)
```

#### Metadata Handling
```python
# Robust metadata extraction with fallbacks
def get_agent_id(ctx):
    # Try multiple sources in priority order
    sources = [
        ctx.job.metadata,
        ctx.room.metadata,
        next((p.metadata for p in ctx.room.participants.values()
              if p.metadata and json.loads(p.metadata).get('agentId')), None)
    ]

    for source in sources:
        if source:
            data = json.loads(source)
            if data.get('agentId'):
                return data['agentId']
    return None
```

#### Error Handling
```python
# Comprehensive error handling with context
try:
    await risky_operation()
except Exception as e:
    logger.error("Operation failed", {
        'error': str(e),
        'conversation_id': conversation_id,
        'agent_id': agent_id,
        'user_id': user_id
    })
    capture_exception(e)
    raise
```

## Voice Agent Capabilities

### OpenAI Realtime Integration
- **Speech-to-text** - Real-time audio transcription
- **Text-to-speech** - Natural voice synthesis
- **Interruption handling** - Smooth conversation flow
- **Language detection** - Automatic language switching
- **Voice customization** - Different voice personalities

### Conversation Features
- **Context retention** - Multi-turn conversation memory
- **CRM integration** - Access to user data and history
- **Workflow triggers** - Voice-activated business processes
- **Contact extraction** - Automatic lead capture from speech
- **Sentiment analysis** - Emotional tone detection

### Technical Features
- **Low-latency streaming** - Sub-second response times
- **Connection resilience** - Automatic reconnection handling
- **Multi-participant support** - Group voice conversations
- **Recording integration** - Conversation archiving
- **Real-time metrics** - Performance monitoring

## Monitoring & Debugging

### Health Checks
- **GET /** - Basic service information
- **GET /health** - Detailed health status
- **LiveKit connectivity** - Room creation and participant management
- **OpenAI API status** - Realtime API availability

### Logging
- **Session lifecycle** - Connection, conversation, disconnection events
- **Audio quality metrics** - Stream performance and quality
- **Error tracking** - Failed operations with Sentry integration
- **Performance metrics** - Response times and throughput

### Common Issues
- **LiveKit connection failures** - API key and URL validation
- **OpenAI API limits** - Rate limiting and quota management
- **Metadata extraction issues** - Room and job metadata configuration
- **Audio quality problems** - Network conditions and codec issues

## Performance Optimization

### Connection Management
- **Persistent sessions** - Keep connections alive across disconnects
- **Connection pooling** - Efficient LiveKit room management
- **Bandwidth optimization** - Audio compression and quality settings
- **Resource cleanup** - Automatic session termination

### Processing Efficiency
- **Streaming processing** - Real-time audio processing without buffering
- **Background tasks** - Non-blocking metadata operations
- **Caching strategy** - Agent configuration and user data caching
- **Batch operations** - Group related API calls

### Scalability Features
- **Horizontal scaling** - Multiple agent server instances
- **Load balancing** - Distribute voice sessions across servers
- **Queue management** - Handle peak loads gracefully
- **Resource limits** - Prevent server overload

## Security Measures

- **JWT validation** - Secure API access tokens
- **Room access control** - LiveKit room permissions
- **Data encryption** - Secure WebRTC connections
- **Audit logging** - All voice interactions tracked
- **Input validation** - Speech content filtering
- **Rate limiting** - API abuse prevention

## Dependencies

### Core Dependencies
- **livekit-agents** - Voice AI framework
- **openai** - Realtime API for speech processing
- **fastapi** - HTTP API server
- **uvicorn** - ASGI server
- **supabase** - Database client
- **pydantic** - Data validation
- **loguru** - Structured logging

### Optional Dependencies
- **sentry-sdk** - Error tracking
- **websockets** - WebSocket client for testing

---

**The voice AI engine that brings Syntera's conversational agents to life through natural speech.**
