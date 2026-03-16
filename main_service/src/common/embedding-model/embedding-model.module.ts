import { Module } from '@nestjs/common';
import { MiniLMEmbeddingModel } from './mini-lm.service';

export const EMBEDDING_MODEL = 'EmbeddingModel';

@Module({
  providers: [MiniLMEmbeddingModel, 
    {
      provide: EMBEDDING_MODEL,
      useClass: MiniLMEmbeddingModel,
    },
  ],
  exports: [EMBEDDING_MODEL],
})
export class EmbeddingModelModule {}
