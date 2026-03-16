import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QueryModule } from './query/query.module';
import { RequestLogModule } from './request-log/request-log.module';
import { Query } from './query/entities/query.entity';
import { RequestLog } from './request-log/entities/request-log.entity';
import { Response } from './response/entities/response.entity';
import { ChromaModule } from './common/chroma/chroma.module';
import { BullmqModule } from './common/bullmq/bullmq.module';
import { RedisModule } from './common/redis/redis.module';
import { EmbeddingModelModule } from './common/embedding-model/embedding-model.module';
import { SemanticFirewallModule } from './common/semantic-firewall/semantic-firewall.module';
import { BullModule } from '@nestjs/bullmq';
import { ResponseModule } from './response/response.module';
import { SemanticCacheModule } from './semantic-cache/semantic-cache.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'postgres',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'app_user',
      password: process.env.DB_PASSWORD || 'app_password',
      database: process.env.DB_NAME || 'app_db',
      entities: [Query, RequestLog, Response],
      synchronize: true,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'redis',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    QueryModule,
    RequestLogModule,
    ChromaModule,
    BullmqModule,
    RedisModule,
    EmbeddingModelModule,
    SemanticFirewallModule,
    ResponseModule,
    SemanticCacheModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
