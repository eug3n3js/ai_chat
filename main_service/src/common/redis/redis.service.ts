import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { CreateRequestLogDto } from 'src/request-log/dto/create-request-log.dto';

const KEY_PREFIX = 'user:query:';
const REQUEST_LOG_PREFIX = 'request_log:';



@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  onModuleInit(): void {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: Number(process.env.REDIS_PORT) || 6379,
    });
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
  }

  async setRequestLog(
    id: string,
    createRequestLogDto: CreateRequestLogDto,
    ttlSeconds: number,
  ): Promise<void> {
    const key = `${REQUEST_LOG_PREFIX}${id}`;
    await this.client.set(key, JSON.stringify(createRequestLogDto), 'EX', ttlSeconds);
  }

  async getRequestLog(id: string): Promise<CreateRequestLogDto | null> {
    const key = `${REQUEST_LOG_PREFIX}${id}`;
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CreateRequestLogDto;
    } catch {
      return null;
    }
  }

  async deleteRequestLog(id: string): Promise<void> {
    const key = `${REQUEST_LOG_PREFIX}${id}`;
    await this.client.del(key);
  }
}
