import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILlmClient } from './llm-client.interface';
import { LoggerService } from '../common/logger/logger.service';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class OllamaLlmClientService implements ILlmClient {
  private readonly model: string;
  private readonly url: string;

  constructor(
    configService: ConfigService,
    private readonly loggerService: LoggerService,
    private readonly redisService: RedisService,
  ) {
    this.model = configService.getOrThrow<string>('OLLAMA_MODEL');
    this.url = `http://${configService.getOrThrow<string>('OLLAMA_HOST')}:${configService.getOrThrow<string>('OLLAMA_PORT')}`;
  }




  private async isCancelled(jobId?: string): Promise<boolean> {
    if (!jobId){
      return false;
    }
    return this.redisService.isLlmJobCancelled(jobId);
  }

  async *streamAnswer(prompt: string, jobId: string): AsyncIterable<string> {
    const url = `${this.url}/api/generate`;
    const abortController = new AbortController();

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: true,
        }),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.loggerService.error('Failed to call Ollama', e instanceof Error ? e.stack : undefined, {
        url,
        model: this.model,
        error: message,
      });
      throw e;
    }

    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => '');
      this.loggerService.error('Ollama responded with non-OK status', undefined, {
        url,
        status: resp.status,
        body: text?.slice(0, 500),
      });
      throw new Error(`Ollama error: ${resp.status} ${resp.statusText}. ${text}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    let doneSeen = false;
    while (true) {
      if (await this.isCancelled(jobId)) {
        abortController.abort();
        throw new Error('Generation cancelled by client');
      }

      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed){
          continue;
        }
        let obj: any;
        try {
          obj = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (obj?.error) {
          const errMsg =
            typeof obj.error === 'string' ? obj.error : JSON.stringify(obj.error);
          this.loggerService.error('Ollama stream returned error', undefined, {
            url,
            model: this.model,
            error: errMsg,
          });
          throw new Error(errMsg);
        }

        if (typeof obj?.response === 'string') {
          yield obj.response;
        }
        if (obj?.done === true) doneSeen = true;
      }

      if (doneSeen){
        break;
      }
    }

    if (!doneSeen) {
      this.loggerService.warn('Ollama stream ended without done=true', {
        url,
        model: this.model,
      });
    }
  }
}

