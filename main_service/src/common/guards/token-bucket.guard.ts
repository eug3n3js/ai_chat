// src/common/guards/chat.guard.ts
import { 
    Injectable, 
    CanActivate, 
    ExecutionContext, 
    HttpException, 
    HttpStatus,
    UnauthorizedException
} from '@nestjs/common';
import { RateLimiterService } from 'src/rate-limiter/rate-limiter.service';
  
@Injectable()
export class TokenBucketGuard implements CanActivate {
  constructor(private readonly rateLimiterService: RateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    let sessionId = request.signedCookies['sessionId'];
    if (!sessionId) {
      throw new UnauthorizedException('Invalid session ID'); 
    }
    
    if (!(await this.rateLimiterService.consume(sessionId))) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}