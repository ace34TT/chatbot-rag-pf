# RAG Chatbot API

A production-ready Retrieval-Augmented Generation (RAG) system that enables intelligent document interactions using Google Gemini AI and Pinecone vector database. Built with modern TypeScript and designed for scalability.

## Overview

This project demonstrates a complete RAG implementation where users can upload documents (PDFs and text files), which are automatically processed, vectorized, and stored for semantic search. The system uses Google's Gemini models for both embeddings and chat completion, providing accurate, context-aware responses based on uploaded content.

## Key Features

- **Document Upload & Processing**: Support for PDF and TXT files with automatic text extraction and chunking
- **Semantic Vector Storage**: Documents are converted to embeddings using Google's text-embedding-004 model and stored in Pinecone
- **Intelligent Querying**: Natural language queries with semantic search to find relevant document sections
- **Context-Aware Responses**: Powered by Google Gemini 2.5 Flash for fast, accurate answers
- **Document Management**: Full CRUD operations including upload, query, delete, and index statistics
- **Type-Safe Architecture**: Built with TypeScript for reliability and maintainability
- **Production Ready**: Comprehensive error handling, validation, and logging

## Architecture

### Tech Stack

- **Runtime**: Node.js with TypeScript
- **Web Framework**: Hono (lightweight, fast, edge-compatible)
- **AI Models**: Google Gemini (text-embedding-004 for embeddings, gemini-2.5-flash for chat)
- **Vector Database**: Pinecone (serverless)
- **Document Processing**: LangChain (PDF parsing, text splitting)
- **Validation**: Zod (runtime type validation)

### Project Structure

```
chatbot-rag/
├── src/
│   ├── config/
│   │   └── env.ts              # Environment config with Zod validation
│   ├── routes/
│   │   └── rag.routes.ts       # REST API endpoints
│   ├── services/
│   │   ├── document.service.ts # Document processing & embedding generation
│   │   └── pinecone.service.ts # Vector database operations
│   ├── types/
│   │   └── document.types.ts   # TypeScript type definitions
│   └── index.ts                # Application entry point & server setup
├── uploads/                    # Temporary file storage
├── .env                        # Environment variables (not committed)
├── .env.example                # Environment template
└── package.json
```

## Setup

### Prerequisites

- Node.js v18 or higher
- npm or yarn package manager
- Pinecone account ([Get API key](https://www.pinecone.io/))
- Google AI Studio account ([Get API key](https://aistudio.google.com/app/apikey))

### Installation

1. **Install dependencies**:

```bash
npm install --legacy-peer-deps
```

2. **Configure environment variables**:

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Update the `.env` file with your credentials:

```env
# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=chatbot-rag

# Google Gemini Configuration
GOOGLE_API_KEY=your_google_api_key_here

# API Authentication (comma-separated list of valid API keys)
API_KEYS=your-secret-api-key-1,your-secret-api-key-2

# Server Configuration
PORT=3000
```

**Important**: Generate strong, random API keys for production. You can use:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. **Build the project** (optional, for production):

```bash
npm run build
```

### Running the Application

**Development mode** (with hot reload):

```bash
npm run dev
```

The server will start at `http://localhost:3000` and automatically initialize the Pinecone index.

**Production mode**:

```bash
npm run build
npm start
```

## Authentication

All API endpoints (except the root endpoint `/`) require authentication via API key.

### How to Authenticate

Include your API key in the request header using one of these methods:

**Method 1: X-API-Key header**
```bash
curl -H "X-API-Key: your-secret-api-key-1" http://localhost:3000/api/rag/health
```

**Method 2: Authorization Bearer token**
```bash
curl -H "Authorization: Bearer your-secret-api-key-1" http://localhost:3000/api/rag/health
```

### Error Responses

**401 Unauthorized** - API key is missing:
```json
{
  "error": "Unauthorized",
  "message": "API key is required. Please provide it via X-API-Key header or Authorization Bearer token."
}
```

**403 Forbidden** - API key is invalid:
```json
{
  "error": "Forbidden",
  "message": "Invalid API key."
}
```

## API Endpoints

### 1. Upload Document

Upload a PDF or TXT document for processing.

**Endpoint:** `POST /api/rag/upload`

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (PDF or TXT file, max 10MB)

**Example:**

```bash
curl -X POST http://localhost:3000/api/rag/upload \
  -H "X-API-Key: your-secret-api-key-1" \
  -F "file=@document.pdf"
```

**Response:**

```json
{
  "success": true,
  "documentId": "uuid-v4-string",
  "fileName": "document.pdf",
  "message": "Document uploaded and processed successfully"
}
```

### 2. Query Documents

Ask questions about your uploaded documents.

**Endpoint:** `POST /api/rag/query`

**Request:**

```json
{
  "query": "What is the main topic of the document?",
  "topK": 5
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/rag/query \
  -H "X-API-Key: your-secret-api-key-1" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the main topic?", "topK": 5}'
```

**Response:**

```json
{
  "answer": "Based on the documents, the main topic is...",
  "sources": [
    {
      "fileName": "document.pdf",
      "score": 0.92,
      "text": "Relevant excerpt from the document..."
    }
  ]
}
```

### 3. Delete Document

Remove a document and its vectors from the database.

**Endpoint:** `DELETE /api/rag/documents/:documentId`

**Example:**

```bash
curl -X DELETE http://localhost:3000/api/rag/documents/your-document-id \
  -H "X-API-Key: your-secret-api-key-1"
```

**Response:**

```json
{
  "success": true,
  "message": "Document deleted successfully",
  "documentId": "your-document-id"
}
```

### 4. Get Index Statistics

Check the Pinecone index statistics (total vector count).

**Endpoint:** `GET /api/rag/stats`

**Response:**

```json
{
  "namespaces": {
    "": {
      "vectorCount": 10
    }
  },
  "dimension": 768,
  "indexFullness": 0.00001
}
```

### 5. Health Check

Verify the API service is running.

**Endpoint:** `GET /api/rag/health`

**Response:**

```json
{
  "status": "ok",
  "service": "RAG API"
}
```

## How It Works

### Document Processing Pipeline

1. **Upload**: User uploads a PDF or TXT file via multipart/form-data
2. **Text Extraction**: PDFs are parsed using pdf-parse, text files are read directly
3. **Chunking**: Documents are split into 1000-character chunks with 200-character overlap using RecursiveCharacterTextSplitter
4. **Embedding Generation**: Each chunk is converted to a 768-dimensional vector using Google's text-embedding-004 model
5. **Metadata Sanitization**: Complex PDF metadata is filtered to only include Pinecone-compatible types
6. **Vector Storage**: Embeddings are batch-upserted to Pinecone with metadata (documentId, fileName, text, chunkIndex, uploadedAt)

### Query Pipeline

1. **Query Embedding**: User's question is converted to a vector using the same embedding model
2. **Semantic Search**: Pinecone performs cosine similarity search to find top K relevant chunks
3. **Context Assembly**: Retrieved chunks are formatted into context for the LLM
4. **Answer Generation**: Google Gemini 2.5 Flash generates a response based on the context
5. **Response**: Answer is returned with source citations (filename, relevance score, text excerpt)

## Implementation Highlights

### Type Safety
- Zod schemas for environment validation
- TypeScript interfaces for all data structures
- Runtime type checking for Pinecone metadata

### Error Handling
- Comprehensive try-catch blocks throughout
- Graceful degradation for missing documents
- Detailed error messages with stack traces in development
- File cleanup on upload failures

### Performance
- Batch processing for Pinecone upserts (100 vectors per batch)
- Parallel embedding generation using Promise.all
- Efficient text chunking with overlap for context preservation

### Security
- **API Key Authentication**: All endpoints protected with middleware-based auth
- **Multiple API Keys**: Support for comma-separated list of valid keys
- **Flexible Auth Headers**: Accept both X-API-Key and Authorization Bearer formats
- **File Type Validation**: Only PDF and TXT files allowed
- **File Size Limits**: 10MB maximum upload size
- **Environment Validation**: Zod schema validation on startup
- **Secure Responses**: No sensitive data or keys exposed in API responses

## Future Enhancements

- [ ] Add support for more document formats (DOCX, PPTX, etc.)
- [ ] Implement user authentication and document ownership
- [ ] Add streaming responses for real-time answer generation
- [ ] Support for multi-tenant environments with namespaced vectors
- [ ] Implement caching layer for frequently asked questions
- [ ] Add metrics and monitoring (Prometheus, Grafana)
- [ ] Web UI for document management and querying

## License

MIT

---

**Portfolio Project** | Built with TypeScript, Google Gemini AI, and Pinecone
