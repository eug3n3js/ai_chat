import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RecaptchaService } from 'src/recaptcha/recaptcha.service';

@Injectable()
export class RecaptchaGuard implements CanActivate {
  constructor(private readonly recaptchaService: RecaptchaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    const token = request.headers['x-recaptcha-token'];

    if (!token) {
      throw new ForbiddenException('reCAPTCHA token is missing');
    }

    const isValid = await this.recaptchaService.verify(token);

    if (!isValid) {
      throw new ForbiddenException('Bot activity detected');
    }

    return true;
  }
}