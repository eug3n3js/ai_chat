import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { RateLimiterModule } from 'src/rate-limiter/rate-limiter.module';
import { RecaptchaModule } from 'src/recaptcha/recaptcha.module';
import { RecaptchaGuard } from 'src/common/guards/recaptcha.guard';

@Module({
  imports: [RateLimiterModule, RecaptchaModule],
  controllers: [AuthController],
  providers: [RecaptchaGuard],
})
export class AuthModule {}

