import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { RateLimiterModule } from './rate-limiter/rate-limiter.module';
import { AuthModule } from './auth/auth.module';
import { RecaptchaModule } from './recaptcha/recaptcha.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '.env'),
    }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('DB_HOST'),
        port: Number(configService.getOrThrow<string>('DB_PORT')),
        username: configService.getOrThrow<string>('DB_USER'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_NAME'),
        entities: [Query, RequestLog, Response],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: Number(configService.getOrThrow<string>('REDIS_PORT')),
        },
      }),
      inject: [ConfigService],
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
    RateLimiterModule,
    AuthModule,
    RecaptchaModule,
  ],
})
export class AppModule {}
