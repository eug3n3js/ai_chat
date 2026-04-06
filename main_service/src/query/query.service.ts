import {
  HttpException,
  Injectable,
  ForbiddenException,
  Inject,
  Logger,
  MessageEvent,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, of, fromEvent, from, defer } from 'rxjs';
import { finalize, filter, map, tap, takeWhile, mergeWith, switchMap, concatMap } from 'rxjs/operators';

import { Query } from './entities/query.entity';
import { ChromaService } from 'src/common/chroma/chroma.service';
import { BullmqManagerService } from 'src/common/bullmq/bullmq-manager.service';
import { RedisService } from 'src/common/redis/redis.service';
import { ResponseService } from 'src/response/response.service';
import { RequestLogService } from 'src/request-log/request-log.service';
import { SemanticCacheService } from 'src/semantic-cache/semantic-cache.service';
import { SemanticFirewallService } from 'src/common/semantic-firewall/semantic-firewall.service';
import { CreateRequestLogDto } from 'src/request-log/dto/create-request-log.dto';
import { SseStreamQueryDto } from './dto/sse-stream-query.dto';
import type { EmbeddingModel } from 'src/common/embedding-model/interfaces/embedding-model.interface';
import { EMBEDDING_MODEL } from 'src/common/embedding-model/embedding-model.module';
import { DatabaseOperationError } from 'src/common/exceptions/database.exception';
import { Response } from 'src/response/entities/response.entity';

const EVENT_PROGRESS = 'llm-query-progress';
const EVENT_COMPLETED = 'llm-query-completed';
const EVENT_FAILED = 'llm-query-failed';
const QUERY_TTL = 60;

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);

  constructor(
    @InjectRepository(Query)
    private readonly repo: Repository<Query>,
    private readonly eventEmitter: EventEmitter2,
    private readonly chromaService: ChromaService,
    private readonly bullmqManager: BullmqManagerService,
    private readonly redisService: RedisService,
    private readonly responseService: ResponseService,
    private readonly requestLogService: RequestLogService,
    private readonly semanticCacheService: SemanticCacheService,
    private readonly semanticFirewallService: SemanticFirewallService,
    @Inject(EMBEDDING_MODEL) private readonly embeddingModel: EmbeddingModel,
  ) {}

  private async run<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: unknown) {
      if (e instanceof HttpException || e instanceof DatabaseOperationError) {
        throw e;
      }
      this.logger.error(`[DB Query] ${operation}`, String(e));
      throw new DatabaseOperationError('Query', operation, e);
    }
  }

  async create(text: string, isPrimary: boolean = false, response?: Response): Promise<Query> {
    return this.run<Query>('create', async () => {
      const entity = this.repo.create({ text, isPrimary, response });
      return await this.repo.save(entity);
    });
  }

  async findOneById(id: string): Promise<Query | null> {
    return this.run<Query | null>('findOneById', async () => {
      return await this.repo.findOne({
        where: { id },
        relations: ['response'],
      });
    });
  }

  async delete(id: string): Promise<void> {
    await this.run<DeleteResult>('delete', () => this.repo.delete(id));
  }

  async saveResponse(jobId: string, fullResponse: string): Promise<void> {
    const createRequestLogDto = await this.ignoreErrors(() => this.redisService.getRequestLog(jobId));
    await this.ignoreErrors(() => this.redisService.deleteRequestLog(jobId));
    if (!createRequestLogDto) {
      return;
    }
    let query: Query | null = null; 
    let response: any | null = null;
    try {
      query = await this.create(createRequestLogDto.requestText!, true);
      createRequestLogDto.queryId = query!.id;
    } catch (error) {
      await this.ignoreErrors(() => this.delete(query!.id));
      return;
    }
    try{
      response = await this.responseService.create(query!.id, fullResponse);
    } catch (error) {
      await this.ignoreErrors(() => this.delete(query!.id));
      await this.ignoreErrors(() => this.responseService.delete(response!.id));
      return;
    }
    try {
      await this.chromaService.addCacheRecord(createRequestLogDto.embedding!, response!.id);
    } catch (error) {
      await this.ignoreErrors(() => this.delete(query!.id));
      await this.ignoreErrors(() => this.responseService.delete(response!.id));
      await this.ignoreErrors(() => this.chromaService.deleteCacheRecord(response!.id));
      return;
    }
    await this.ignoreErrors(() => this.requestLogService.logProccessedQuery(createRequestLogDto));
  }

  proccessQuery(dto: SseStreamQueryDto): Observable<MessageEvent> {
    return defer(() => from(this.executeQuery(dto))).pipe(
      switchMap((result) => {
        if (typeof result === 'object') {
          return of(result);
        }
        return this.createSseStream(result);
      })
    );
  }
  
  async executeQuery(dto: SseStreamQueryDto): Promise<MessageEvent | string> {
    try{
      const queryEmbedding = await this.embeddingModel.embed(dto.text);
      if (!(await this.semanticFirewallService.isValidQuery(queryEmbedding))) {
        throw new ForbiddenException('Query has low relevance');
      }
      const cachedResponse = await this.semanticCacheService.findRelevantByEmbedding(queryEmbedding);
      if (cachedResponse) {
        const query = await this.create(dto.text, false, cachedResponse);
        await this.requestLogService.logCachedQuery({
          startTime: new Date(),
          queryId: query.id,
        });
        return {
          type: 'completed',
          data: { event: 'completed', cached: true, returnvalue: cachedResponse.text },
        } satisfies MessageEvent;
      }
      const jobId = await this.bullmqManager.addQuery({ text: dto.text });
      const createRequestLogDto: CreateRequestLogDto = {
        startTime: new Date(),
        requestText: dto.text, 
        embedding: queryEmbedding,
      };
      await this.redisService.setRequestLog(jobId, createRequestLogDto, QUERY_TTL);
      return jobId;
    } catch (error) {

      if (error instanceof HttpException) {
        return {
          type: 'failed',
          data: {
            failedReason: error.message,
          },
        } satisfies MessageEvent;
      }
      this.logger.error('executeQuery', error);
      return {
        type: 'failed',
        data: {
          failedReason: 'Unknown error',
        },
      } satisfies MessageEvent;
    }
  };

  private createSseStream(jobId: string): Observable<MessageEvent> {
    const progressStream = fromEvent(this.eventEmitter, EVENT_PROGRESS).pipe(
      filter((p: any) => p.jobId === jobId),
      map((p: any) => ({ type: 'progress', data: p.progress}))
    );

    const completedStream = fromEvent(this.eventEmitter, EVENT_COMPLETED).pipe(
      filter((p: any) => p.jobId === jobId),
      concatMap((p: any) => from(this.saveResponse(jobId, p.returnvalue)).pipe(
        map(() => ({ type: 'completed', data: { returnvalue: p.returnvalue } }))
      )),
    );

    const failedStream = fromEvent(this.eventEmitter, EVENT_FAILED).pipe(
      filter((p: any) => p.jobId === jobId),
      map((p: any) => ({ type: 'failed', data: { failedReason: "Unknown error" } }))
    );
    const mergedStream = progressStream.pipe(mergeWith(completedStream)).pipe(mergeWith(failedStream));
    return mergedStream.pipe(
      takeWhile((e: any) => e.type !== 'completed' && e.type !== 'failed', true),
      finalize(() => {
        this.redisService.markLlmJobCancelled(jobId, 900);
      }),
      map((e: any) => e)
    );
  }

  private async ignoreErrors<T>(fn: () => Promise<T>): Promise<T | null> {
    try { return await fn(); } catch { return null; }
  }
}
