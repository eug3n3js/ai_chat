import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FeatureExtractionPipeline, pipeline } from '@xenova/transformers';
import { EmbeddingModel } from './interfaces/embedding-model.interface';

@Injectable()
export class MiniLMEmbeddingModel implements EmbeddingModel, OnModuleInit, OnModuleDestroy {
  private extractor: FeatureExtractionPipeline | null = null;

  async onModuleInit() {
    this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  async onModuleDestroy() {
    this.extractor = null;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.extractor) {
      this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    const result: any = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(result.data as Float32Array);
  }
}
