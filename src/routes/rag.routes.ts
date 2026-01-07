import {Hono} from 'hono';
import {documentService} from '../services/document.service.js';
import {ChatGoogleGenerativeAI} from '@langchain/google-genai';
import {HumanMessage} from '@langchain/core/messages';
import {env} from '../config/env.js';
import {writeFile} from 'fs/promises';
import {join} from 'path';
import {apiKeyAuth} from '../middleware/auth.middleware.js';

const ragRouter = new Hono();

// Apply authentication middleware to all routes
ragRouter.use('*', apiKeyAuth);

// Upload document endpoint
ragRouter.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({error: 'No file provided'}, 400);
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      return c.json(
          {error: 'Invalid file type. Only PDF and TXT files are allowed.'},
          400
      );
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return c.json({error: 'File size exceeds 10MB limit'}, 400);
    }

    // Save file temporarily
    const buffer = await file.arrayBuffer();
    const fileName = file.name;
    const filePath = join('uploads', `${Date.now()}-${fileName}`);
    await writeFile(filePath, Buffer.from(buffer));

    // Process document
    const documentId = await documentService.processDocument(filePath, fileName);

    return c.json({
      success: true,
      documentId,
      fileName,
      message: 'Document uploaded and processed successfully',
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return c.json(
        {
          error: 'Failed to upload document',
          details: error.message,
        },
        500
    );
  }
});

// Query documents endpoint
ragRouter.post('/query', async (c) => {
  try {
    const {query, topK = 5, similarityThreshold = 0.3} = await c.req.json();

    if (!query) {
      return c.json({error: 'Query is required'}, 400);
    }

    console.log(`Query: "${query}", topK: ${topK}`);

    // Get relevant documents
    const relevantDocs = await documentService.queryDocuments(query, topK);
    console.log(`Found ${relevantDocs.length} relevant documents`);

    // Check if we have any documents
    if (relevantDocs.length === 0) {
      console.log('No documents in index, responding conversationally');

      const llm = new ChatGoogleGenerativeAI({
        model: 'gemini-2.5-flash',
        apiKey: env.GOOGLE_API_KEY,
        temperature: 0.7,
      });

      const response = await llm.invoke([
        new HumanMessage(`You are a helpful AI assistant for Tafinasoa Rabenandrasana's portfolio. The user said: "${query}".
Respond warmly and let them know that you can help answer questions about Tafinasoa's experience, skills, and projects once documents are uploaded.

IMPORTANT: Respond in the SAME LANGUAGE as the user's message. If they wrote in French, respond in French. If in English, respond in English.`)
      ]);

      const answer = typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      return c.json({
        answer,
        sources: [],
        conversational: true,
      });
    }

    // Check similarity scores - if the best match is below threshold, treat as conversational
    const bestScore = relevantDocs[0]?.score || 0;
    console.log(`Best similarity score: ${bestScore}`);

    if (bestScore < similarityThreshold) {
      console.log(`Score ${bestScore} below threshold ${similarityThreshold}, treating as conversational`);

      const llm = new ChatGoogleGenerativeAI({
        model: 'gemini-2.5-flash',
        apiKey: env.GOOGLE_API_KEY,
        temperature: 0.7,
      });

      const response = await llm.invoke([
        new HumanMessage(`You are a helpful AI assistant for Tafinasoa Rabenandrasana's portfolio. The user said: "${query}".
Respond warmly and professionally. If it's a greeting, welcome them and offer to help answer questions about Tafinasoa's experience, skills, education, or projects.

IMPORTANT: Respond in the SAME LANGUAGE as the user's message. If they wrote in French, respond in French. If in English, respond in English.`)
      ]);

      const answer = typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      return c.json({
        answer,
        sources: [],
        conversational: true,
      });
    }

    // High similarity score - use RAG mode
    console.log('High similarity score, using RAG mode');

    // Prepare context for LLM
    const context = relevantDocs
        .map((doc, idx) => `[Document ${idx + 1}]: ${doc.text}`)
        .join('\n\n');

    console.log('Generating answer with Gemini...');

    // Generate answer using Gemini with strict context adherence
    const llm = new ChatGoogleGenerativeAI({
      model: 'gemini-2.5-flash',
      apiKey: env.GOOGLE_API_KEY,
      temperature: 0.1,
    });

    const prompt = `You are an AI assistant helping visitors learn about Tafinasoa Rabenandrasana's professional background. Answer questions using ONLY the information from the provided context.

Rules:
1. Answer using ONLY information from the context below
2. If the answer is not in the context, say in the user's language that you don't have that specific information and suggest asking about Tafinasoa's experience, skills, education, or projects
3. Do NOT use external knowledge or make assumptions
4. Be professional, concise, and helpful
5. When discussing experience or skills, reference specific details from the context
6. IMPORTANT: Respond in the SAME LANGUAGE as the question. If the question is in French, answer in French. If in English, answer in English.

Context:
${context}

Question: ${query}

Answer:`;

    const response = await llm.invoke([
      new HumanMessage(prompt)
    ]);

    console.log('Response received from Gemini');

    const answer = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    return c.json({
      answer,
      sources: relevantDocs.map((doc) => ({
        fileName: doc.fileName,
        score: doc.score,
        text: typeof doc.text === 'string'
          ? doc.text.substring(0, 200) + '...'
          : '',
      })),
    });
  } catch (error: any) {
    console.error('Query error:', error);
    console.error('Error stack:', error.stack);
    return c.json(
        {
          error: 'Failed to process query',
          details: error.message,
          stack: error.stack,
        },
        500
    );
  }
});

// Delete document endpoint
ragRouter.delete('/documents/:documentId', async (c) => {
  try {
    const {documentId} = c.req.param();

    if (!documentId) {
      return c.json({error: 'Document ID is required'}, 400);
    }

    const result = await documentService.deleteDocument(documentId);

    return c.json({
      success: true,
      message: 'Document deleted successfully',
      documentId: result.documentId,
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    return c.json(
        {
          error: 'Failed to delete document',
          details: error.message,
        },
        500
    );
  }
});

// Health check endpoint
ragRouter.get('/health', (c) => {
  return c.json({status: 'ok', service: 'RAG API'});
});

// Get index stats endpoint
ragRouter.get('/stats', async (c) => {
  try {
    const stats = await documentService.getIndexStats();
    return c.json(stats);
  } catch (error: any) {
    console.error('Stats error:', error);
    return c.json(
        {
          error: 'Failed to get index stats',
          details: error.message,
        },
        500
    );
  }
});

export {ragRouter};
