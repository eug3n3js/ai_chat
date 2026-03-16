import { Injectable } from '@nestjs/common';
import { ChromaClient, Collection } from 'chromadb';
import { v4 } from 'uuid';

export interface ChromaSearchResult {
  id: string;
  text: string;
  similarity: number;
}

const CACHE_COLLECTION = 'cache';
const FIREWALL_COLLECTION = 'firewall';

@Injectable()
export class ChromaService {
  private readonly client = new ChromaClient({
    path: process.env.CHROMA_URL || 'http://chromadb:8000',
  });

  private async getOrCreateCosineCollection(name: string): Promise<Collection> {
    return this.client.getOrCreateCollection({
      name,
      metadata: { 'hnsw:space': 'cosine' },
    });
  }

  async deleteCollection(name: string): Promise<void> {
    try {
      await this.client.deleteCollection({ name });
    } catch (e: any) {
      if (e?.name === 'ChromaNotFoundError') {
        return;
      }
      throw e;
    }
  }

  async deleteCacheCollection(): Promise<void> {
    await this.deleteCollection(CACHE_COLLECTION);
  }

  async deleteFirewallCollection(): Promise<void> {
    await this.deleteCollection(FIREWALL_COLLECTION);
  }

  async addCacheRecord(embedding: number[], responseId: string): Promise<void> {
    await this.addRecord(CACHE_COLLECTION, embedding, responseId);
  }

  async addFirewallRecord(embedding: number[]): Promise<void> {
    await this.addRecord(FIREWALL_COLLECTION, embedding, String(v4()));
  }

  async addRecord(
    collectionName: string,
    embedding: number[],
    responseId: string,
  ): Promise<void> {
    const collection = await this.getOrCreateCosineCollection(collectionName);
    await collection.add({
      ids: [responseId],
      embeddings: [embedding],
    });
  }

  async deleteRecord(collectionName: string, id: string): Promise<void> {
    const collection = await this.getOrCreateCosineCollection(collectionName);
    await collection.delete({ ids: [id] });
  }

  async deleteCacheRecord(responseId: string): Promise<void> {
    await this.deleteRecord(CACHE_COLLECTION, responseId);
  }

  async deleteFirewallRecord(id: string): Promise<void> {
    await this.deleteRecord(FIREWALL_COLLECTION, id);
  }



  async searchCacheWithThreshold(queryEmbedding: number[], minSimilarity: number): Promise<ChromaSearchResult[]> {
    return this.searchCosineWithThreshold(CACHE_COLLECTION, queryEmbedding, minSimilarity, 1);
  }


  async searchFirewallWithThreshold(queryEmbedding: number[], minSimilarity: number): Promise<ChromaSearchResult[]> {
    return this.searchCosineWithThreshold(FIREWALL_COLLECTION, queryEmbedding, minSimilarity, 1);
  }

  async searchCosineWithThreshold(
    collectionName: string,
    queryEmbedding: number[],
    minSimilarity: number,
    limit: number
  ): Promise<ChromaSearchResult[]> {
    const collection = await this.getOrCreateCosineCollection(collectionName);

    const response = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
    });

    if (!response.ids?.[0]) {
      return [];
    }

    const ids = response.ids[0];
    const docs = response.documents[0];
    const distances = response.distances[0];

    return ids
      .map((id, index) => ({
        id,
        text: docs[index] as string,
        similarity: Number((1 - (distances[index] ?? 1)).toFixed(4)),
      }))
      .filter((item) => item.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity);
  }
}
