import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private readonly logger = new Logger('llmservice');

  log(message: string, meta?: unknown): void {
    this.logger.log(message, meta as any);
  }

  warn(message: string, meta?: unknown): void {
    this.logger.warn(message, meta as any);
  }

  error(message: string, trace?: string, meta?: unknown): void {
    this.logger.error(message, trace, meta as any);
  }
}

