// src/common/rate-limiter/rate-limiter.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { TokenBucket } from './entities/token-bucket.entity';

@Injectable()
export class RateLimiterService {
  private BUCKET_CAPACITY: number;
  private REFILL_RATE: number;
  private EXPIRY_TIME: number;


  constructor(private readonly redisService: RedisService, private readonly configService: ConfigService) {
    this.BUCKET_CAPACITY = this.configService.getOrThrow<number>('RATE_LIMIT_CAPACITY');
    this.REFILL_RATE = this.configService.getOrThrow<number>('RATE_LIMIT_REFILL_RATE');
    this.EXPIRY_TIME = this.configService.getOrThrow<number>('SESSION_EXPIRY_TIME');
  }

  async consume(sessionId: string): Promise<boolean> {
    const now = Date.now();

    const bucket = await this.redisService.getTokenBucket(sessionId);
    if (!bucket) {
      return false;
    }

    let tokens = bucket.tokens;
    let lastRefill = bucket.lastRefill;
    const timePassed = Math.max(0, now - lastRefill) / 1000; 
    const refill = timePassed * this.REFILL_RATE;
    tokens = Math.min(this.BUCKET_CAPACITY, tokens + refill);
    lastRefill = now;
    if (tokens >= 1) {
      tokens -= 1;
      await this.redisService.setTokenBucket(sessionId, new TokenBucket(tokens, lastRefill), this.EXPIRY_TIME);
      return true;
    }

    await this.redisService.setTokenBucket(sessionId, new TokenBucket(tokens, now), this.EXPIRY_TIME);



    return false;
  }

  async initNewBucket(sessionId: string): Promise<void> {
    await this.redisService.setTokenBucket(
      sessionId,
      new TokenBucket(this.BUCKET_CAPACITY, Date.now() / 1000),
      this.EXPIRY_TIME,
    );
  }

  async checkBucket(sessionId: string): Promise<boolean> {
    const bucket = await this.redisService.getTokenBucket(sessionId);
    if (!bucket) {
      return false;
    }
    return bucket.tokens > 0;
  }
}