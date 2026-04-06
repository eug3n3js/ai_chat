import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const LLM_CANCEL_PREFIX = 'llm:cancel:';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: Number(this.configService.getOrThrow<string>('REDIS_PORT')),
    });

    this.client.on('error', (err: Error) => {
      this.logger.error(`[Redis] client error: ${err.message}`, err.stack);
    });
  }

  async isLlmJobCancelled(jobId: string): Promise<boolean> {
    const key = `${LLM_CANCEL_PREFIX}${jobId}`;
    const exists = await this.client.exists(key);
    return exists === 1;
  }
}

