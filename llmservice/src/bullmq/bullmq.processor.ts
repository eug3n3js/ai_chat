import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { LLM_CLIENT } from '../llm-client/llm-client.module';
import type { ILlmClient } from '../llm-client/llm-client.interface';
import { LoggerService } from '../common/logger/logger.service';

export interface LlmJobData {
  text: string;
}

const QUEUE_NAME = 'llm-service';
const JOB_NAME = 'llm-query';
const CONCURRENCY = 2;

@Processor(QUEUE_NAME, { concurrency: CONCURRENCY })
@Injectable()
export class BullmqProcessor extends WorkerHost {
  constructor(
    @Inject(LLM_CLIENT) private readonly llmClient: ILlmClient,
    private readonly loggerService: LoggerService,
  ) {
    super();
  }

  async process(job: Job<LlmJobData, string>): Promise<string> {
    if (job.name !== JOB_NAME) {
      return '';
    }

    const prompt = job.data!.text;
    let fullText = '';
    for await (const chunk of this.llmClient.streamAnswer(prompt, job.id!)) {
      fullText += chunk;
      console.log('CHUNK:', chunk);
      await job.updateProgress({ progress: chunk });
    }

    const result = fullText.trim();
    if (!result) {
      this.loggerService.error('Ollama returned empty response', undefined, {
        jobId: job.id,
        promptPreview: prompt.slice(0, 200),
      });
    }

    return result;

  }
}
