import { Module } from '@nestjs/common';
import { MockLlmClientService } from './mock-llm-client.service';

export const LLM_CLIENT = 'ILlmClient';

@Module({
  providers: [
    {
      provide: LLM_CLIENT,
      useClass: MockLlmClientService,
    },
  ],
  exports: [LLM_CLIENT],
})
export class LlmClientModule {}
