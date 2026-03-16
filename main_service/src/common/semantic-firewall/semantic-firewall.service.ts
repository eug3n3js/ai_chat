import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaService } from '../chroma/chroma.service';
import fs from 'fs';
import type { EmbeddingModel } from '../embedding-model/interfaces/embedding-model.interface';
import { EMBEDDING_MODEL } from '../embedding-model/embedding-model.module';


@Injectable()
export class SemanticFirewallService implements OnModuleInit, OnModuleDestroy {
  private readonly threshold: number;
  private readonly filePath: string;

  constructor(
    private readonly chromaService: ChromaService,
    @Inject(EMBEDDING_MODEL) private readonly embeddingModel: EmbeddingModel,
    configService: ConfigService,
  ) {
    this.threshold = Number(configService.getOrThrow('SEMANTIC_FIREWALL_THRESHOLD'));
    this.filePath = String(configService.getOrThrow('SEMANTIC_FIREWALL_FILE_PATH'));
  }

  async onModuleInit(): Promise<void> {
    await this.chromaService.deleteFirewallCollection();
    const fileContent = fs.readFileSync(this.filePath, 'utf8');
    const lines = fileContent.split('\n');
    if (lines.length === 0) {
        throw new Error('Sample queries file is empty');
    }
    for (const line of lines) {
      const text = line;
      const vector = await this.embeddingModel.embed(text);
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
}
