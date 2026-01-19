# 🤖 Syntera Embeddable Widget

**Production-ready AI chat widget for website integration with real-time voice calls and comprehensive error handling.**

## Overview

The Syntera widget is a standalone, embeddable TypeScript application that provides AI-powered customer support directly on any website. It features real-time text chat, voice calls via LiveKit, WebSocket connectivity, and enterprise-grade error handling.

**Technology**: TypeScript, Vite, LiveKit WebRTC, Socket.io  
**Bundle Size**: ~200KB gzipped  
**Browser Support**: Modern browsers with WebRTC support

## Core Features

### 💬 **Real-time Text Chat**
- **WebSocket connectivity** - Persistent connections with automatic reconnection
- **Message threading** - Conversation organization and context management
- **Typing indicators** - Real-time user feedback
- **Message history** - Persistent conversation storage
- **File attachments** - Support for document uploads

### 🎤 **Voice Call Integration**
- **LiveKit WebRTC** - Low-latency voice communication
- **Audio streaming** - Real-time bidirectional audio
- **Call controls** - Mute/unmute, volume controls
- **Connection resilience** - Automatic reconnection on network issues
- **Background noise handling** - Audio quality optimization

### 🎨 **Advanced UI/UX**
- **Floating widget button** - Customizable position and styling
- **Responsive design** - Mobile-optimized interface
- **Dark/light themes** - Automatic theme detection
- **Accessibility** - Keyboard navigation and screen reader support
- **Emoji picker** - Rich text input with emoji support

### 🛡️ **Enterprise Features**
- **Error handling** - Comprehensive error banners and recovery
- **GDPR compliance** - Consent management and data protection
- **Sentry integration** - Error tracking and monitoring
- **Rate limiting** - API abuse prevention
- **Audit logging** - Security event tracking

## Architecture

### Widget Structure
```
widget/
├── src/
│   ├── index.ts              # Auto-initialization from script tag
│   ├── widget.ts             # Main SynteraWidget class
│   ├── types.ts              # TypeScript interfaces
│   ├── styles.css            # Widget styling
│   ├── api/
│   │   ├── client.ts         # HTTP API client (REST endpoints)
│   │   ├── websocket.ts      # WebSocket client (real-time events)
│   │   └── livekit.ts        # LiveKit client (voice calls)
│   ├── ui/
│   │   ├── chat-interface.ts  # Complete chat UI component
│   │   └── gdpr-consent.ts    # GDPR consent modal
│   └── utils/
│       ├── logger.ts         # Structured logging
│       ├── sentry.ts         # Error tracking
│       └── icons.ts          # SVG icon components
├── dist/
│   ├── widget.iife.js        # UMD bundle for browsers
│   ├── widget.css            # Compiled styles
│   └── *.d.ts                # TypeScript declarations
└── test.html                # Development testing page
```

### Component Architecture

#### **SynteraWidget Class**
Main orchestrator handling initialization, configuration, and lifecycle management:

```typescript
class SynteraWidget {
  async init(): Promise<void> {
    // Load agent configuration
    // Initialize API clients
    // Create UI components
    // Setup error handling
  }

  async startChat(): Promise<void> {
    // Create conversation
    // Initialize WebSocket connection
    // Render chat interface
  }

  async startVoiceCall(): Promise<void> {
    // Get LiveKit token
    // Initialize voice connection
    // Handle audio streaming
  }
}
```

#### **ChatInterface Component**
Complete chat UI with message handling, typing indicators, and voice controls:

```typescript
class ChatInterface {
  private createMessageBubble(message: Message): HTMLElement {
    // Render message with timestamp
    // Add reaction capabilities
    // Handle file attachments
  }

  private handleVoiceCall(): void {
    // Initialize LiveKit connection
    // Setup audio streaming
    // Update UI state
  }
}
```

## API Integration

### Required Endpoints
The widget communicates with Syntera's backend services:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/public/agents/:id` | GET | Fetch agent configuration |
| `/api/public/conversations` | POST | Create new conversation |
| `/api/public/messages` | POST | Send chat messages |
| `/api/public/livekit/token` | POST | Get voice call tokens |
| `/api/public/websocket/config` | POST | Get WebSocket configuration |

### Real-time Events (WebSocket)
```
Client → Server:
├── message:send        # Send chat message
├── typing:start        # Show typing indicator
├── call:start          # Initiate voice call
└── conversation:join   # Join conversation room

Server → Client:
├── message:new         # New message received
├── typing:update       # Typing status changes
├── call:status         # Voice call status updates
└── error               # Error notifications
```

## Configuration & Initialization

### Script Tag Integration
```html
<script src="https://cdn.syntera.com/widget.iife.js"
        data-agent-id="agent-123"
        data-api-key="pub_key_abc"
        data-api-url="https://api.syntera.com"
        data-position="bottom-right"
        data-theme="auto"
        data-debug="false">
</script>
```

### Configuration Options

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-agent-id` | ✅ Yes | - | Syntera agent identifier |
| `data-api-key` | ✅ Yes | - | Public API key for authentication |
| `data-api-url` | ❌ No | `https://api.syntera.com` | Backend API base URL |
| `data-position` | ❌ No | `bottom-right` | Widget position: `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `data-theme` | ❌ No | `auto` | Theme: `light`, `dark`, `auto` |
| `data-debug` | ❌ No | `false` | Enable debug logging |

### Programmatic Usage
```typescript
import { SynteraWidget } from '@syntera/widget'

const widget = new SynteraWidget({
  agentId: 'agent-123',
  apiKey: 'pub_key_abc',
  apiUrl: 'https://api.syntera.com',
  position: 'bottom-right',
  theme: 'auto',
  sentryDsn: 'https://sentry-dsn', // Optional
})

// Initialize widget
await widget.init()

// Programmatic control
widget.open()           // Show chat
widget.close()          // Hide chat
await widget.sendMessage('Hello!')
```

## Development & Building

### Local Development
```bash
cd widget

# Install dependencies
pnpm install

# Development server with hot reload
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm type-check
```

### Build Output
```bash
dist/
├── widget.iife.js      # UMD bundle (~200KB)
├── widget.css          # Styles (~15KB)
├── widget.d.ts         # TypeScript declarations
└── *.d.ts.map          # Source maps
```

### Testing
```bash
# Open test page in browser
open test.html

# Or serve locally
python -m http.server 8000
# Visit http://localhost:8000/test.html
```

## Error Handling & Monitoring

### Error Recovery
- **Connection failures** - Automatic reconnection with exponential backoff
- **API errors** - User-friendly error messages with retry options
- **Audio issues** - Fallback to text-only mode
- **Network interruptions** - State preservation and recovery

### Monitoring Integration
```typescript
// Sentry error tracking
if (config.sentryDsn) {
  initSentry({
    dsn: config.sentryDsn,
    environment: 'production',
    agentId: config.agentId,
  })
}

// Structured logging
logger.info('Widget initialized', {
  agentId: config.agentId,
  theme: config.theme,
  userAgent: navigator.userAgent
})
```

## Browser Compatibility

### Supported Browsers
- **Chrome/Edge**: 88+ (WebRTC support)
- **Firefox**: 87+ (WebRTC support)
- **Safari**: 14+ (WebRTC support)
- **Mobile Safari**: iOS 14.5+
- **Chrome Android**: 88+

### Feature Detection
The widget automatically detects and adapts to browser capabilities:
- **WebRTC support** - Falls back to text-only if unavailable
- **WebSocket support** - Graceful degradation for older browsers
- **CSS Grid/Flexbox** - Progressive enhancement for layouts

## Performance Optimization

### Bundle Optimization
- **Tree shaking** - Unused code elimination
- **Code splitting** - Lazy loading of non-critical features
- **Compression** - Gzip/Brotli compression
- **Caching** - Aggressive caching headers

### Runtime Performance
- **Virtual scrolling** - Efficient message list rendering
- **Debounced inputs** - Reduced API calls during typing
- **Memory management** - Automatic cleanup of event listeners
- **Image optimization** - Lazy loading and responsive images

## Security Considerations

### Data Protection
- **HTTPS only** - Secure connections for all communications
- **API key rotation** - Regular credential updates
- **Input sanitization** - XSS prevention and validation
- **Session isolation** - No cross-conversation data leakage

### Privacy Compliance
- **GDPR consent** - User permission for data collection
- **Data minimization** - Only necessary data collection
- **Right to erasure** - User data deletion capabilities
- **Audit trails** - Complete activity logging

## Deployment & Hosting

### CDN Deployment
```bash
# Build production bundle
pnpm build

# Upload to CDN
aws s3 cp dist/ s3://cdn.syntera.com/widget/ --recursive

# CDN URL: https://cdn.syntera.com/widget/widget.iife.js
```

### Version Management
- **Semantic versioning** - Major.minor.patch releases
- **Changelog maintenance** - Feature and bug fix documentation
- **Backwards compatibility** - API stability guarantees
- **Deprecation notices** - Advance warning for breaking changes

---

**Enterprise-grade embeddable AI chat widget with voice capabilities and comprehensive error handling.**

