import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RecaptchaService } from './recaptcha.service';

@Module({
  imports: [HttpModule],
  providers: [RecaptchaService],
  exports: [RecaptchaService],
})
export class RecaptchaModule {}
