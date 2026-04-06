import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaService } from '../common/chroma/chroma.service';
import { ResponseService } from '../response/response.service';
import { Response } from '../response/entities/response.entity';


@Injectable()
export class SemanticCacheService {
  private readonly threshold: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly chromaService: ChromaService,
    private readonly responseService: ResponseService,
  ) {
    this.threshold =
      Number(this.configService.getOrThrow<string>('SEMANTIC_CACHE_THRESHOLD'));
  }

  async findRelevantByEmbedding(embedding: number[]): Promise<Response | null> {
    const results = await this.chromaService.searchCacheWithThreshold(embedding, this.threshold);

    if (results.length === 0) {
      return null;
    }

    const top = results[0];
    const response = await this.responseService.findOneById(top.id);
    return response;
  }
}
