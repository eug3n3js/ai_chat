import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaService } from '../chroma/chroma.service';
import type { EmbeddingModel } from '../embedding-model/interfaces/embedding-model.interface';
import { EMBEDDING_MODEL } from '../embedding-model/embedding-model.module';


@Injectable()
export class SemanticFirewallService implements OnModuleInit, OnModuleDestroy {
  private readonly threshold: number;
  private readonly sentences: string[];

  constructor(
    private readonly chromaService: ChromaService,
    @Inject(EMBEDDING_MODEL) private readonly embeddingModel: EmbeddingModel,
    private readonly configService: ConfigService,
  ) {
    this.threshold = Number(this.configService.getOrThrow('SEMANTIC_FIREWALL_THRESHOLD'));
    const header = this.configService
      .getOrThrow<string>('SEMANTIC_FIREWALL_SENTENCES_HEADER')
      .trim();
    this.sentences = this.loadSentences(header);
  }

  async onModuleInit(): Promise<void> {
    await this.chromaService.deleteFirewallCollection();
    for (const sentence of this.sentences) {
      const vector = await this.embeddingModel.embed(sentence);
      await this.chromaService.addFirewallRecord(vector);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.chromaService.deleteFirewallCollection();
  }

  async isValidQuery(queryEmbedding: number[]): Promise<boolean> {
    const results = await this.chromaService.searchFirewallWithThreshold(queryEmbedding, this.threshold); 
    return results.length !== 0;
  }

  private loadSentences(header: string): string[] {
    const out: string[] = [];
    for (let i = 0; ; i += 1) {
      const key = `${header}_${i}`;
      const value = this.configService.get<string>(key);
      if (value === undefined) {
        break;
      }
      const trimmed = value.trim();
      if (trimmed) {
        out.push(trimmed);
      }
    }
    if (out.length === 0) {
      throw new Error(
        `No semantic firewall sentences found. Expected env keys: ${header}_0, ${header}_1, ...`,
      );
    }
    return out;
  }
}
  