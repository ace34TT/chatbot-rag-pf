import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { Document } from '@langchain/core/documents';
import { env } from '../config/env.js';
import { pineconeService } from './pinecone.service.js';
import { readFileSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type {QueryResult} from "../types/document.types.js";

// Helper function to sanitize metadata for Pinecone
function sanitizeMetadata(metadata: Record<string, any>): Record<string, string | number | boolean | string[]> {
  const sanitized: Record<string, string | number | boolean | string[]> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      sanitized[key] = value;
    } else if (typeof value === 'object') {
      // Skip complex objects that Pinecone doesn't support
      continue;
    }
  }

  return sanitized;
}

export class DocumentService {
  private embeddings: GoogleGenerativeAIEmbeddings;
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: env.GOOGLE_API_KEY,
      model: 'text-embedding-004',
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  }

  async processDocument(filePath: string, fileName: string): Promise<string> {
    const documentId = uuidv4();
    let docs: Document[] = [];

    try {
      // Determine file type and load accordingly
      if (fileName.endsWith('.pdf')) {
        const loader = new PDFLoader(filePath);
        docs = await loader.load();
      } else if (fileName.endsWith('.txt')) {
        const text = readFileSync(filePath, 'utf-8');
        docs = [new Document({ pageContent: text, metadata: {} })];
      } else {
        throw new Error('Unsupported file type. Please upload PDF or TXT files.');
      }

      // Split documents into chunks
      const splitDocs = await this.textSplitter.splitDocuments(docs);
      console.log(`Split document into ${splitDocs.length} chunks`);

      // Generate embeddings and prepare vectors
      console.log('Generating embeddings...');
      const vectors = await Promise.all(
        splitDocs.map(async (doc, index) => {
          const embedding = await this.embeddings.embedQuery(doc.pageContent);

          // Sanitize PDF metadata to only include Pinecone-compatible types
          const sanitizedMetadata = sanitizeMetadata(doc.metadata);

          return {
            id: `${documentId}-chunk-${index}`,
            values: embedding,
            metadata: {
              documentId,
              fileName,
              text: doc.pageContent,
              chunkIndex: index,
              uploadedAt: new Date().toISOString(),
              ...sanitizedMetadata,
            },
          };
        })
      );
      console.log(`Generated ${vectors.length} embeddings`);

      // Upsert to Pinecone
      await pineconeService.upsertVectors(vectors);

      // Clean up uploaded file
      unlinkSync(filePath);

      return documentId;
    } catch (error) {
      // Clean up file on error
      try {
        unlinkSync(filePath);
      } catch {}
      throw error;
    }
  }

  async queryDocuments(query: string, topK: number = 5): Promise<QueryResult[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Query Pinecone
      const results = await pineconeService.queryVectors(queryEmbedding, topK);

      // Format results with proper type casting
      return results.matches?.map((match) => ({
        id: match.id,
        score: match.score,
        text: typeof match.metadata?.text === 'string' ? match.metadata.text : '',
        fileName: typeof match.metadata?.fileName === 'string' ? match.metadata.fileName : 'unknown',
        documentId: typeof match.metadata?.documentId === 'string' ? match.metadata.documentId : '',
        chunkIndex: typeof match.metadata?.chunkIndex === 'number' ? match.metadata.chunkIndex : 0,
      })) || [];
    } catch (error) {
      console.error('Error querying documents:', error);
      throw error;
    }
  }

  async deleteDocument(documentId: string) {
    try {
      await pineconeService.deleteByDocumentId(documentId);
      return { success: true, documentId };
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  async getIndexStats() {
    return await pineconeService.getIndexStats();
  }
}

export const documentService = new DocumentService();
