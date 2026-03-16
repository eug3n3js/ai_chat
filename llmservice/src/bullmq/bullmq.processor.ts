import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { LLM_CLIENT } from '../llm-client/llm-client.module';
import type { ILlmClient } from '../llm-client/llm-client.interface';

export interface LlmJobData {
  text: string;
  userId?: string;
  queryId?: string;
}

const QUEUE_NAME = 'llm-service';
const JOB_NAME = 'llm-query';

@Processor(QUEUE_NAME)
@Injectable()
export class BullmqProcessor extends WorkerHost {
  constructor(@Inject(LLM_CLIENT) private readonly llmClient: ILlmClient) {
    super();
  }

  async process(job: Job<LlmJobData, string>): Promise<string> {
    if (job.name !== JOB_NAME) {
      return '';
    }

    const prompt = job.data?.text ?? '';
    let fullText = '';

    for await (const chunk of this.llmClient.streamAnswer(prompt)) {
      fullText += chunk;
      await job.updateProgress({ progress: chunk });
    }

    return fullText.trim();
  }
}
