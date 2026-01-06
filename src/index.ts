import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { ragRouter } from './routes/rag.routes.js';
import { pineconeService } from './services/pinecone.service.js';
import { env } from './config/env.js';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'RAG Chatbot API',
    version: '1.0.0',
    endpoints: {
      upload: 'POST /api/rag/upload',
      query: 'POST /api/rag/query',
      delete: 'DELETE /api/rag/documents/:documentId',
      health: 'GET /api/rag/health',
    },
  });
});

// Mount RAG routes
app.route('/api/rag', ragRouter);

// Initialize Pinecone and start server
const startServer = async () => {
  try {
    console.log('Initializing Pinecone index...');
    await pineconeService.initializeIndex();
    console.log('Pinecone index initialized successfully');

    const port = parseInt(String(env.PORT)) || 3000;

    serve(
      {
        fetch: app.fetch,
        port,
      },
      (info) => {
        console.log(`\n🚀 Server is running on http://localhost:${info.port}`);
        console.log(`📚 API Documentation: http://localhost:${info.port}/`);
      }
    );
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
