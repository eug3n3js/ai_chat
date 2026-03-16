import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRequestLogDto } from './dto/create-request-log.dto';
import { RequestLog } from './entities/request-log.entity';
import type { Query } from 'src/query/entities/query.entity';

@Injectable()
export class RequestLogService {
  constructor(
    @InjectRepository(RequestLog)
    private readonly repo: Repository<RequestLog>,
  ) {}

  async create(queryId: string, source: string, durationMs: number): Promise<RequestLog> {
    const entity = this.repo.create({
      query: { id: queryId } as Query,
      source: source,
      durationMs: durationMs,
    });
    return this.repo.save(entity);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }

  async logCachedQuery(createRequestLogDto: CreateRequestLogDto): Promise<RequestLog> {
    return await this.create(createRequestLogDto.queryId!, 'cached', Date.now() - (new Date(createRequestLogDto.startTime)).getTime());
  }

  async logProccessedQuery(createRequestLogDto: CreateRequestLogDto): Promise<RequestLog> {
    return await this.create(createRequestLogDto.queryId!, 'processed', Date.now() - (new Date(createRequestLogDto.startTime)).getTime());
  }
}
