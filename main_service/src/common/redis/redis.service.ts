import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisOperationError } from 'src/common/exceptions/redis.exception';
import { TokenBucket } from 'src/rate-limiter/entities/token-bucket.entity';
import { CreateRequestLogDto } from 'src/request-log/dto/create-request-log.dto';

const REQUEST_LOG_PREFIX = 'request_log:';
const RATE_LIMIT_PREFIX = 'rate:bucket:';
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

  private async run<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: unknown) {
      if (e instanceof RedisOperationError) {
        throw e;
      }
      this.logger.error(`[Redis] ${operation}`, String(e));
      throw new RedisOperationError(operation, e);
    }
  }

  async setRequestLog(
    id: string,
    createRequestLogDto: CreateRequestLogDto,
    ttlSeconds: number,
  ): Promise<void> {
    await this.run<void>(
      'setRequestLog',
      this.setRequestLogInternal.bind(this, id, createRequestLogDto, ttlSeconds),
    );
  }

  async getRequestLog(id: string): Promise<CreateRequestLogDto | null> {
    return this.run<CreateRequestLogDto | null>('getRequestLog', this.getRequestLogInternal.bind(this, id));
  }

  async deleteRequestLog(id: string): Promise<void> {
    await this.run<void>('deleteRequestLog', this.deleteRequestLogInternal.bind(this, id));
  }

  async getTokenBucket(sessionId: string): Promise<TokenBucket | null> {
    return this.run<TokenBucket | null>('getTokenBucket', this.getTokenBucketInternal.bind(this, sessionId));
  }

  async setTokenBucket(sessionId: string, tokenBucket: TokenBucket, ttlSeconds: number): Promise<void> {
    await this.run<void>(
      'setTokenBucket',
      this.setTokenBucketInternal.bind(this, sessionId, tokenBucket, ttlSeconds),
    );
  }

  async markLlmJobCancelled(jobId: string, ttlSeconds = 300): Promise<void> {
    await this.run<void>(
      'markLlmJobCancelled',
      this.markLlmJobCancelledInternal.bind(this, jobId, ttlSeconds),
    );
  }

  private async setRequestLogInternal(
    id: string,
    createRequestLogDto: CreateRequestLogDto,
    ttlSeconds: number,
  ): Promise<void> {
    const key = `${REQUEST_LOG_PREFIX}${id}`;
    await this.client.set(key, JSON.stringify(createRequestLogDto), 'EX', ttlSeconds);
  }

  private async getRequestLogInternal(id: string): Promise<CreateRequestLogDto | null> {
    const key = `${REQUEST_LOG_PREFIX}${id}`;
    const raw = await this.client.get(key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as CreateRequestLogDto;
    } catch (e: unknown) {
      this.logger.error(
        `[Redis] getRequestLog(${id}): invalid JSON`,
        String(e),
      );
      throw new RedisOperationError(`getRequestLog(${id}): invalid JSON`, e);
    }
  }

  private async deleteRequestLogInternal(id: string): Promise<void> {
    const key = `${REQUEST_LOG_PREFIX}${id}`;
    await this.client.del(key);
  }

  private async getTokenBucketInternal(sessionId: string): Promise<TokenBucket | null> {
    const key = `${RATE_LIMIT_PREFIX}${sessionId}`;
    const raw = await this.client.hgetall(key);
    if (!raw || Object.keys(raw).length === 0) {
      return null;
    }
    try {
      return TokenBucket.fromRedis(raw);
    } catch (e: unknown) {
      this.logger.error(
        `[Redis] getTokenBucket(${sessionId}): invalid bucket data`,
        String(e),
      );
      throw new RedisOperationError(`getTokenBucket(${sessionId}): invalid bucket data`, e);
    }
  }

  private async setTokenBucketInternal(
    sessionId: string,
    tokenBucket: TokenBucket,
    ttlSeconds: number,
  ): Promise<void> {
    const key = `${RATE_LIMIT_PREFIX}${sessionId}`;
    await this.client.hset(
      key,
      'tokens',
      String(tokenBucket.tokens),
      'lastRefill',
      String(tokenBucket.lastRefill),
    );
    await this.client.expire(key, ttlSeconds);
  }

  private async markLlmJobCancelledInternal(jobId: string, ttlSeconds: number): Promise<void> {
    const key = `${LLM_CANCEL_PREFIX}${jobId}`;
    await this.client.set(key, '1', 'EX', ttlSeconds);
  }
}
