import { Injectable } from '@nestjs/common';
import { ILlmClient } from './llm-client.interface';
import { randomInt } from 'crypto';

const MOCK_DELAY_MS = randomInt(800, 2000);
const MOCK_SUFFIX = ' [mock response]';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class MockLlmClientService implements ILlmClient {
  async *streamAnswer(prompt: string, _jobId: string): AsyncIterable<string> {
    const words = prompt.trim().split(/\s+/).filter(Boolean);
    for (const word of words) {
      yield word + ' ' + String(Math.random());
      await delay(MOCK_DELAY_MS);
    }
    yield MOCK_SUFFIX;
  }
}
