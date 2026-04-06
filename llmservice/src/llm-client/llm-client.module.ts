import { Module } from '@nestjs/common';
import { OllamaLlmClientService } from './ollama-llm-client.service';
import { LoggerModule } from '../common/logger/logger.module';
import { RedisModule } from '../common/redis/redis.module';

export const LLM_CLIENT = 'ILlmClient';

@Module({
  imports: [LoggerModule, RedisModule],
  providers: [
    {
      provide: LLM_CLIENT,
      useClass: OllamaLlmClientService,
    },
  ],
  exports: [LLM_CLIENT],
})
export class LlmClientModule {}
