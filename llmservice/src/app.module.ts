import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullmqModule } from './bullmq/bullmq.module';
import { LlmClientModule } from './llm-client/llm-client.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    BullmqModule,
    LlmClientModule,
  ],
})
export class AppModule {}
