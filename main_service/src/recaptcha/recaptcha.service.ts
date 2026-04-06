import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecaptchaOperationError } from 'src/common/exceptions/recaptcha.exception';

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  private RECAPTCHA_SECRET_KEY: string;
  private RECAPTCHA_SCORE_THRESHOLD: number;
  private RECAPTCHA_URL: string;

  constructor(
    private readonly configService: ConfigService,
  ) {

    this.RECAPTCHA_SECRET_KEY = this.configService.getOrThrow<string>('RECAPTCHA_SECRET_KEY');
    this.RECAPTCHA_SCORE_THRESHOLD = this.configService.getOrThrow<number>('RECAPTCHA_SCORE_THRESHOLD');
    this.RECAPTCHA_URL = this.configService.getOrThrow<string>('RECAPTCHA_URL');
  }

  async verify(token: string): Promise<boolean> {
    return this.run('verify', this.verifyInternal.bind(this, token));
  }

  private async run<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: unknown) {
      if (e instanceof RecaptchaOperationError) {
        throw e;
      }
      this.logger.error(
        `[Recaptcha] ${operation}`,
        e instanceof Error ? e.stack : String(e),
      );
      throw new RecaptchaOperationError(operation, e);
    }
  }

  private async verifyInternal(token: string): Promise<boolean> {
    const body = new URLSearchParams({
      secret: this.RECAPTCHA_SECRET_KEY,
      response: token,
    });

    const response = await fetch(this.RECAPTCHA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new RecaptchaOperationError(
        'verifyInternal',
        `HTTP ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      success?: boolean;
      score?: number;
    };

    if (!data.success) {
      return false;
    }
    if (typeof data.score === 'number' && data.score < this.RECAPTCHA_SCORE_THRESHOLD) {
      return false;
    }
    return true;
  }
}
