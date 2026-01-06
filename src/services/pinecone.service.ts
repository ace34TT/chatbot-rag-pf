import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '../config/env.js';

class PineconeService {
  private client: Pinecone;
  private indexName: string;

  constructor() {
    this.client = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });
    this.indexName = env.PINECONE_INDEX_NAME;
  }

  async initializeIndex() {
    try {
      const indexes = await this.client.listIndexes();
      const indexExists = indexes.indexes?.some(
        (index) => index.name === this.indexName
      );

      if (!indexExists) {
        console.log(`Creating index: ${this.indexName}`);
        await this.client.createIndex({
          name: this.indexName,
          dimension: 768, // Google text-embedding-004 dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1',
            },
          },
        });
        console.log('Index created successfully');
        // Wait for index to be ready
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      return this.client.index(this.indexName);
    } catch (error) {
      console.error('Error initializing Pinecone index:', error);
      throw error;
    }
  }

  getIndex() {
    return this.client.index(this.indexName);
  }

  async upsertVectors(vectors: Array<{
    id: string;
    values: number[];
    metadata: Record<string, any>;
  }>) {
    const index = this.getIndex();
    console.log(`Upserting ${vectors.length} vectors to Pinecone...`);

    // Pinecone recommends batching upserts (max 100 vectors per batch for serverless)
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.upsert(batch);
      console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
    }

    console.log(`Successfully upserted ${vectors.length} vectors`);
  }

  async queryVectors(queryVector: number[], topK: number = 5) {
    const index = this.getIndex();
    const results = await index.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
    });
    return results;
  }

  async deleteByDocumentId(documentId: string) {
    const index = this.getIndex();
    await index.deleteMany({ filter: { documentId } });
  }

  async getIndexStats() {
    const index = this.getIndex();
    const stats = await index.describeIndexStats();
    return stats;
  }
}

export const pineconeService = new PineconeService();
