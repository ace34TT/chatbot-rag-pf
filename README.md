# RAG Chatbot API

A Retrieval-Augmented Generation (RAG) chatbot API built with Hono, Pinecone, and OpenAI. Upload documents and interact with them using natural language queries.

## Features

- Upload PDF and TXT documents
- Automatic document vectorization and storage in Pinecone
- Query documents using natural language
- Context-aware responses powered by OpenAI GPT
- Delete documents from the vector database

## Project Structure

```
chatbot-rag/
├── src/
│   ├── config/
│   │   └── env.ts              # Environment configuration
│   ├── routes/
│   │   └── rag.routes.ts       # RAG API endpoints
│   ├── services/
│   │   ├── document.service.ts # Document processing
│   │   └── pinecone.service.ts # Pinecone operations
│   ├── utils/
│   │   └── multer.ts           # File upload handler
│   └── index.ts                # Application entry point
├── uploads/                    # Temporary file storage
├── .env.example                # Environment template
└── package.json
```

## Setup

### Prerequisites

- Node.js (v18 or higher)
- Pinecone account and API key
- OpenAI API key

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Create a `.env` file from the example:

```bash
cp .env.example .env
```

3. Configure your environment variables in `.env`:

```env
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=chatbot-rag
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
```

### Running the Application

Development mode with hot reload:

```bash
npm run dev
```

Build and run production:

```bash
npm run build
npm start
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
curl -X DELETE http://localhost:3000/api/rag/documents/your-document-id
```

**Response:**

```json
{
  "success": true,
  "message": "Document deleted successfully",
  "documentId": "your-document-id"
}
```

### 4. Health Check

Check if the service is running.

**Endpoint:** `GET /api/rag/health`

**Response:**

```json
{
  "status": "ok",
  "service": "RAG API"
}
```

## How It Works

1. **Document Upload**: Documents are uploaded and split into chunks using LangChain's text splitter
2. **Vectorization**: Each chunk is converted to embeddings using OpenAI's text-embedding-3-small model
3. **Storage**: Vectors are stored in Pinecone with metadata (filename, chunk index, etc.)
4. **Querying**: User queries are converted to embeddings and matched against stored vectors
5. **Response Generation**: Relevant chunks are retrieved and sent to GPT-4 for answer generation

## Technologies

- **Hono**: Fast web framework for building APIs
- **Pinecone**: Vector database for similarity search
- **OpenAI**: Embeddings and chat completion
- **LangChain**: Document processing and text splitting
- **TypeScript**: Type-safe development

## Error Handling

The API includes comprehensive error handling for:
- Invalid file types
- File size limits
- Missing environment variables
- Pinecone connection issues
- OpenAI API errors

## License

MIT
# chatbot-rag-pf
