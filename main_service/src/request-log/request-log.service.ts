import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { DatabaseOperationError } from 'src/common/exceptions/database.exception';
import { CreateRequestLogDto } from './dto/create-request-log.dto';
import { RequestLog } from './entities/request-log.entity';
import type { Query } from 'src/query/entities/query.entity';

@Injectable()
export class RequestLogService {
  private readonly logger = new Logger(RequestLogService.name);

  constructor(
    @InjectRepository(RequestLog)
    private readonly repo: Repository<RequestLog>,
  ) {}

  private async run<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: unknown) {
      if (e instanceof DatabaseOperationError) {
        throw e;
      }
      this.logger.error(
        `[DB RequestLog] ${operation}`,
        e instanceof Error ? e.stack : String(e),
      );
      throw new DatabaseOperationError('RequestLog', operation, e);
    }
  }

  async create(queryId: string, source: string, durationMs: number): Promise<RequestLog> {
    return this.run('create', async () => {
      const entity = this.repo.create({
        query: { id: queryId } as Query,
        source: source,
        durationMs: durationMs,
      });
      return this.repo.save(entity);
    });
  }

  async delete(id: number): Promise<void> {
    await this.run<DeleteResult>('delete', () => this.repo.delete(id));
  }

  async logCachedQuery(createRequestLogDto: CreateRequestLogDto): Promise<RequestLog> {
    return await this.run<RequestLog>('logCachedQuery', async () => {
      const requestLog = await this.create(createRequestLogDto.queryId!, 'cached', Date.now() - (new Date(createRequestLogDto.startTime)).getTime());
      return requestLog;
    });
  }

  async logProccessedQuery(createRequestLogDto: CreateRequestLogDto): Promise<RequestLog> {
    return await this.run<RequestLog>('logProccessedQuery', async () => {
      const requestLog = await this.create(createRequestLogDto.queryId!, 'processed', Date.now() - (new Date(createRequestLogDto.startTime)).getTime());
      return requestLog;
    });
  }
}
