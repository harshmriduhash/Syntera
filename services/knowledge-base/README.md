# 📚 Knowledge Base Service

**Document processing and retrieval-augmented generation (RAG) engine.**

## Overview

The Knowledge Base Service handles document ingestion, text processing, vector embeddings, and semantic search capabilities. It powers Syntera's intelligent knowledge retrieval by converting documents into searchable vector representations.

**Port**: 4005  
**Technology**: Node.js, Express, TypeScript  
**Databases**: PostgreSQL (metadata) + Pinecone (vectors) + Redis (cache)

## Core Responsibilities

### 📄 Document Processing
- **Multi-format support** - PDF, DOCX, TXT, and other document types
- **Text extraction** - Advanced OCR and parsing capabilities
- **Chunking strategies** - Intelligent document segmentation
- **Metadata extraction** - Title, author, timestamps, and custom fields

### 🔍 Vector Search
- **Semantic embeddings** - Convert text to vector representations
- **Similarity search** - Find relevant documents by meaning
- **Hybrid search** - Combine semantic and keyword search
- **Relevance ranking** - Score and rank search results

### 🎯 RAG Integration
- **Context retrieval** - Fetch relevant knowledge for AI responses
- **Prompt engineering** - Include retrieved knowledge in AI prompts
- **Citation tracking** - Reference source documents in responses
- **Confidence scoring** - Reliability metrics for retrieved content

### 🔄 Background Processing
- **Job queues** - Asynchronous document processing
- **Batch operations** - Bulk document ingestion
- **Progress tracking** - Real-time processing status
- **Error recovery** - Failed job retry mechanisms

## API Endpoints

### Document Management
```
POST   /api/documents            # Upload new document
GET    /api/documents            # List documents
GET    /api/documents/:id        # Get document details
DELETE /api/documents/:id        # Delete document
GET    /api/documents/:id/status # Processing status
```

### Search Operations
```
POST   /api/documents/search     # Semantic search across documents
GET    /api/documents/search/suggest # Search suggestions
```

### Batch Operations
```
POST   /api/documents/batch      # Upload multiple documents
GET    /api/documents/batch/:id  # Batch processing status
DELETE /api/documents/batch/:id  # Cancel batch operation
```

## Architecture

### Service Structure
```
src/
├── config/           # Database and service configuration
├── services/         # Core business logic
│   ├── processor.ts  # Document processing pipeline
│   ├── queue.ts      # Job queue management (BullMQ)
│   ├── pinecone.ts   # Vector database operations
│   └── embeddings.ts # OpenAI embeddings client
├── routes/           # Express route handlers
│   └── documents.ts  # Document CRUD operations
├── utils/            # Helper functions
└── types/            # TypeScript interfaces
```

### Processing Pipeline

#### Document Ingestion
```mermaid
graph LR
    A[Document Upload] --> B[Format Detection]
    B --> C[Text Extraction]
    C --> D[Content Chunking]
    D --> E[Metadata Extraction]
    E --> F[Vector Embedding]
    F --> G[Pinecone Storage]
    G --> H[PostgreSQL Metadata]
```

#### Search Flow
```mermaid
graph LR
    A[Search Query] --> B[Query Embedding]
    B --> C[Pinecone Similarity Search]
    C --> D[Relevance Ranking]
    D --> E[Result Formatting]
    E --> F[Context Retrieval]
```

### Key Components

#### Document Processor
```typescript
// Multi-format document processing pipeline
class DocumentProcessor {
  async processDocument(file: Buffer, metadata: DocumentMetadata) {
    const text = await extractText(file, file.type)
    const chunks = await chunkText(text, { size: 1000, overlap: 200 })
    const embeddings = await generateEmbeddings(chunks)

    return { chunks, embeddings, metadata }
  }
}
```

#### Vector Search
```typescript
// Semantic similarity search
const searchResults = await pineconeIndex.query({
  vector: queryEmbedding,
  topK: 5,
  includeMetadata: true,
  includeValues: false
})
```

#### Job Queue Management
```typescript
// Asynchronous document processing
const documentJob = await enqueueDocument(documentId)

// Job processor
documentQueue.process(async (job) => {
  const { documentId } = job.data
  await processDocument(documentId)
})
```

## Data Flow

### Document Upload Process
1. **File validation** → Check format, size, and content type
2. **Text extraction** → Convert document to plain text
3. **Intelligent chunking** → Split into semantic units (1000 chars, 200 overlap)
4. **Vector generation** → Create embeddings for each chunk
5. **Storage** → Save vectors to Pinecone, metadata to PostgreSQL
6. **Indexing** → Make document searchable and retrievable

### Search and Retrieval
1. **Query processing** → Clean and validate search input
2. **Embedding generation** → Convert query to vector representation
3. **Similarity search** → Find most relevant document chunks
4. **Relevance filtering** → Apply confidence thresholds
5. **Context assembly** → Combine related chunks into coherent response
6. **Source attribution** → Include document references and citations

### Background Processing
1. **Job queuing** → Add documents to processing queue
2. **Worker allocation** → Distribute work across available workers
3. **Progress tracking** → Update processing status in real-time
4. **Error handling** → Retry failed jobs with exponential backoff
5. **Cleanup** → Remove temporary files and failed job artifacts

## Configuration

### Environment Variables
```bash
# OpenAI
OPENAI_API_KEY=sk-your-key

# Pinecone
PINECONE_API_KEY=your-pinecone-key
PINECONE_INDEX_NAME=syntera-docs
PINECONE_ENVIRONMENT=your-environment

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Processing
MAX_FILE_SIZE=50mb
SUPPORTED_FORMATS=pdf,docx,txt,md
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

## Development

### Local Setup
```bash
cd services/knowledge-base
pnpm install
pnpm dev
```

### Testing Document Upload
```bash
# Health check
curl http://localhost:4005/health

# Upload document
curl -X POST http://localhost:4005/api/documents \
  -F "file=@document.pdf" \
  -F "metadata={\"title\":\"Sample Doc\",\"tags\":[\"test\"]}"
```

### Key Development Patterns

#### File Processing
```typescript
// Handle different document formats
const processFile = async (buffer: Buffer, mimeType: string) => {
  switch (mimeType) {
    case 'application/pdf':
      return await processPDF(buffer)
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return await processDOCX(buffer)
    default:
      return await processText(buffer)
  }
}
```

#### Vector Operations
```typescript
// Batch embedding generation
const embeddings = await openai.embeddings.create({
  model: 'text-embedding-ada-002',
  input: textChunks,
  encoding_format: 'float'
})
```

#### Queue Management
```typescript
// Job lifecycle handling
documentQueue.on('completed', (job) => {
  logger.info('Document processed successfully', { documentId: job.data.documentId })
})

documentQueue.on('failed', (job, err) => {
  logger.error('Document processing failed', { documentId: job.data.documentId, error: err.message })
})
```

## Supported Document Formats

| Format | MIME Type | Processing Method |
|--------|-----------|-------------------|
| PDF | `application/pdf` | Text extraction with pdf-parse |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | mammoth.js parsing |
| TXT | `text/plain` | Direct text processing |
| MD | `text/markdown` | Markdown parsing |

## Performance Optimization

### Processing Efficiency
- **Parallel chunking** - Process multiple chunks simultaneously
- **Batch embeddings** - Generate multiple embeddings in single API call
- **Memory management** - Stream large files to prevent memory issues
- **Caching** - Cache frequently accessed documents and embeddings

### Search Optimization
- **Index optimization** - Pinecone index configuration for speed
- **Query caching** - Redis cache for frequent search queries
- **Result limiting** - Cap results to prevent overwhelming responses
- **Scoring algorithms** - Optimize relevance ranking algorithms

### Scalability Features
- **Horizontal scaling** - Multiple worker instances
- **Queue partitioning** - Distribute load across multiple queues
- **Rate limiting** - Prevent API quota exhaustion
- **Background retries** - Automatic retry for transient failures

## Monitoring & Debugging

### Health Checks
- **GET /health** - Service availability and queue status
- **Processing metrics** - Documents processed per minute
- **Queue status** - Active jobs, waiting jobs, failed jobs
- **Storage metrics** - Vector database usage and limits

### Logging
- **Document lifecycle** - Upload, processing, completion events
- **Search analytics** - Query performance and result quality
- **Error tracking** - Failed processing jobs and search errors
- **Performance metrics** - Processing times and throughput

### Common Issues
- **Large file uploads** - File size limits and memory constraints
- **Embedding failures** - OpenAI API rate limits and token limits
- **Vector search timeouts** - Pinecone query performance issues
- **Queue congestion** - High volume document processing backlogs

## Security Measures

- **File validation** - Content type and malware scanning
- **Access control** - Company-scoped document access
- **Audit logging** - All document operations tracked
- **Rate limiting** - Upload and search abuse prevention
- **Data encryption** - Secure storage of sensitive documents

## Dependencies

### Core Dependencies
- **@pinecone-database/pinecone** - Vector database client
- **openai** - Embedding generation and text processing
- **bullmq** - Job queue management
- **mammoth** - DOCX document processing
- **pdf-parse** - PDF text extraction
- **multer** - File upload handling

### Development Dependencies
- **typescript** - Type safety
- **tsx** - Development server
- **express-rate-limit** - API abuse prevention

---

**The intelligent knowledge engine that powers contextual AI responses in Syntera.**
