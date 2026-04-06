import { Controller, Get, HttpCode, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RecaptchaGuard } from 'src/common/guards/recaptcha.guard';
import { RateLimiterService } from 'src/rate-limiter/rate-limiter.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly rateLimiterService: RateLimiterService 
  ) {}

  @Get()
  @HttpCode(204)
  @UseGuards(RecaptchaGuard)
  async authorize(@Req() req: Request): Promise<void> {
    if (req.signedCookies['sessionId']) {
      return;
    }
    const sessionId = req['sessionId'];
    if (!sessionId) return;
    await this.rateLimiterService.initNewBucket(sessionId);
    return;
  }
}

