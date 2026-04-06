import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LlmClientModule } from '../llm-client/llm-client.module';
import { BullmqProcessor } from './bullmq.processor';
import { LoggerModule } from '../common/logger/logger.module';

const QUEUE_NAME = 'llm-service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: Number(config.get<string>('REDIS_PORT')) || 6379,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: QUEUE_NAME }),
    LlmClientModule,
    LoggerModule,
  ],
  providers: [BullmqProcessor],
})
export class BullmqModule {}
