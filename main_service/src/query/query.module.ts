import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryService } from './query.service';
import { QueryController } from './query.controller';
import { Query } from './entities/query.entity';
import { BullmqModule } from '../common/bullmq/bullmq.module';
import { RedisModule } from '../common/redis/redis.module';
import { ResponseModule } from '../response/response.module';
import { ChromaModule } from '../common/chroma/chroma.module';
import { EmbeddingModelModule } from '../common/embedding-model/embedding-model.module';
import { SemanticFirewallModule } from '../common/semantic-firewall/semantic-firewall.module';
import { SemanticCacheModule } from 'src/semantic-cache/semantic-cache.module';
import { RequestLogModule } from 'src/request-log/request-log.module';
import { TokenBucketGuard } from 'src/common/guards/token-bucket.guard';
import { RateLimiterModule } from 'src/rate-limiter/rate-limiter.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Query]),
    BullmqModule,
    RedisModule,
    ResponseModule,
    ChromaModule,
    EmbeddingModelModule,
    SemanticFirewallModule,
    SemanticFirewallModule,
    SemanticCacheModule,
    RequestLogModule,
    RateLimiterModule,
  ],
  controllers: [QueryController],
  providers: [QueryService, TokenBucketGuard],
  exports: [QueryService],
})
export class QueryModule {}
