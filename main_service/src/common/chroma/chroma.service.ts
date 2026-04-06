import { Injectable, Logger } from '@nestjs/common';
import { ChromaClient, Collection } from 'chromadb';
import { v4 } from 'uuid';
import { ChromaOperationError } from 'src/common/exceptions/chroma.exception';
import { ConfigService } from '@nestjs/config';

export interface ChromaSearchResult {
  id: string;
  text: string;
  similarity: number;
}

const CACHE_COLLECTION = 'cache';
const FIREWALL_COLLECTION = 'firewall';

@Injectable()
export class ChromaService {
  private readonly logger = new Logger(ChromaService.name);
  private readonly client: ChromaClient;

  constructor(private readonly configService: ConfigService) {
    const chromaUrl = new URL(this.configService.getOrThrow<string>('CHROMA_URL'));
    this.client = new ChromaClient({
      host: this.configService.getOrThrow<string>('CHROMA_HOST'),
      port: Number(this.configService.getOrThrow<string>('CHROMA_PORT')),
      ssl: this.configService.getOrThrow<string>('CHROMA_SSL') === 'true',
    });
  }

  private async run<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: unknown) {
      if (e instanceof ChromaOperationError) {
        throw e;
      }
      this.logger.error(`[Chroma] ${operation}`, String(e));
      throw new ChromaOperationError(operation, e);
    }
  }

  private async getOrCreateCosineCollection(name: string): Promise<Collection> {
    return await this.client.getOrCreateCollection({
      name,
      metadata: { 'hnsw:space': 'cosine' },
    });
  }

  async deleteCacheCollection(): Promise<void> {
    await this.run<void>('deleteCacheCollection', this.deleteCollectionInternal.bind(this, CACHE_COLLECTION));
  }

  async deleteFirewallCollection(): Promise<void> {
    await this.run<void>('deleteFirewallCollection', this.deleteCollectionInternal.bind(this, FIREWALL_COLLECTION));
  }

  async addCacheRecord(embedding: number[], responseId: string): Promise<void> {
    await this.run<void>('addCacheRecord', this.addRecordInternal.bind(this, CACHE_COLLECTION, embedding, responseId));
  }

  async addFirewallRecord(embedding: number[]): Promise<void> {
    await this.run<void>('addFirewallRecord', this.addRecordInternal.bind(this, FIREWALL_COLLECTION, embedding, String(v4())));
  }

  async deleteCacheRecord(responseId: string): Promise<void> {
    await this.run<void>('deleteCacheRecord', this.deleteRecordInternal.bind(this, CACHE_COLLECTION, responseId));
  }

  async deleteFirewallRecord(id: string): Promise<void> {
    await this.run<void>('deleteFirewallRecord', this.deleteRecordInternal.bind(this, FIREWALL_COLLECTION, id));
  }

  async searchCacheWithThreshold(queryEmbedding: number[], minSimilarity: number): Promise<ChromaSearchResult[]> {
    return this.run<ChromaSearchResult[]>('searchCacheWithThreshold', this.searchCosineWithThresholdInternal.bind(this, CACHE_COLLECTION, queryEmbedding, minSimilarity, 1));
  }

  async searchFirewallWithThreshold(queryEmbedding: number[], minSimilarity: number): Promise<ChromaSearchResult[]> {
    return this.run<ChromaSearchResult[]>('searchFirewallWithThreshold', this.searchCosineWithThresholdInternal.bind(this, FIREWALL_COLLECTION, queryEmbedding, minSimilarity, 1));
  }

  private async deleteCollectionInternal(name: string): Promise<void> {
    try {
      await this.client.deleteCollection({ name });
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name === 'ChromaNotFoundError') {
        return;
      }
      throw new ChromaOperationError('deleteCollection', e);
    }
  }

  private async addRecordInternal(
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

  private async deleteRecordInternal(collectionName: string, id: string): Promise<void> {
    const collection = await this.getOrCreateCosineCollection(collectionName);
    await collection.delete({ ids: [id] });
  }

  private async searchCosineWithThresholdInternal(
    collectionName: string,
    queryEmbedding: number[],
    minSimilarity: number,
    limit: number,
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
        similarity: Number((1 - (distances?.[index] ?? 1)).toFixed(4)),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .filter((item) => item.similarity >= minSimilarity);
  }
}
