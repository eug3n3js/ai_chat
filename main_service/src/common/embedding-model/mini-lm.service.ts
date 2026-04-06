import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FeatureExtractionPipeline, pipeline } from '@xenova/transformers';
import { EmbeddingModel } from './interfaces/embedding-model.interface';
import { EmbeddingModelOperationError } from '../exceptions/embedding-model.exception';

@Injectable()
export class MiniLMEmbeddingModel implements EmbeddingModel, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MiniLMEmbeddingModel.name);
  private extractor: FeatureExtractionPipeline | null = null;

  async onModuleInit() {
    await this.run<void>('onModuleInit', this.initExtractor.bind(this));
  }

  async onModuleDestroy() {
    this.extractor = null;
  }

  async embed(text: string): Promise<number[]> {
    return this.run<number[]>('embed', this.embedInternal.bind(this, text));
  }

  private async run<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: unknown) {
      if (e instanceof EmbeddingModelOperationError) {
        throw e;
      }
      this.logger.error(
        `[MiniLM] ${operation}`,
        e instanceof Error ? e.stack : String(e),
      );
      throw new EmbeddingModelOperationError(operation, e);
    }
  }

  private async initExtractor(): Promise<void> {
    this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  private async embedInternal(text: string): Promise<number[]> {
    const extractor = this.extractor;
    if (!extractor) {
      throw new EmbeddingModelOperationError('embedInternal', 'Extractor is not initialized');
    }

    const result = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    if (!('data' in result) || !(result.data instanceof Float32Array)) {
      throw new EmbeddingModelOperationError('embedInternal', 'Unexpected extractor result format');
    }

    return Array.from(result.data);
  }
}
