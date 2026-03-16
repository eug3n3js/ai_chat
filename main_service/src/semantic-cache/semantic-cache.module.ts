import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChromaModule } from '../common/chroma/chroma.module';
import { ResponseModule } from '../response/response.module';
import { SemanticCacheService } from './semantic-cache.service';

@Module({
  imports: [ConfigModule, ChromaModule, ResponseModule],
  providers: [SemanticCacheService],
  exports: [SemanticCacheService],
})
export class SemanticCacheModule {}
