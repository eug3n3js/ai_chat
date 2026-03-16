import { Injectable, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, of, fromEvent, from, defer } from 'rxjs';
import { finalize, filter, map, tap, takeWhile, mergeWith, switchMap } from 'rxjs/operators';

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

const EVENT_PROGRESS = 'llm-query-progress';
const EVENT_COMPLETED = 'llm-query-completed';
const EVENT_FAILED = 'llm-query-failed';
const QUERY_TTL = 60;

@Injectable()
export class QueryService {
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

  async create(text: string, isPrimary: boolean = false): Promise<Query> {
    const entity = this.repo.create({ text, isPrimary });
    return await this.repo.save(entity);
  }

  async findOneById(id: string): Promise<Query | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['response'],
    });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async saveResponse(jobId: string, fullResponse: string): Promise<void> {
    const createRequestLogDto = await this.redisService.getRequestLog(jobId);
    if (!createRequestLogDto) {
      return;
    }
    console.log('CREATE REQUEST LOG DTO from redis:', createRequestLogDto);
    const query = await this.create(createRequestLogDto.requestText!, true);
    const response = await this.responseService.create(query.id, fullResponse);
    console.log('RESPONSE:', response);
    await this.chromaService.addCacheRecord(createRequestLogDto.embedding!, response.id);
    createRequestLogDto.queryId = query.id;
    await this.requestLogService.logProccessedQuery(createRequestLogDto);
    await this.redisService.deleteRequestLog(jobId);
  }


  proccessQuery(dto: SseStreamQueryDto): Observable<MessageEvent> {
    return defer(() => from(this.executeQuery(dto))).pipe(
      switchMap((result) => {
        if (typeof result === 'object') return of(result);
        return this.createSseStream(result);
      })
    );
  }
  
  async executeQuery(dto: SseStreamQueryDto): Promise<MessageEvent | string> {
    console.log('TEXT GOT:', dto.text);
    const queryEmbedding = await this.embeddingModel.embed(dto.text);
    console.log('QUERY EMBEDDING:', queryEmbedding);
    console.log('SEMANTIC FIREWALL:', await this.semanticFirewallService.isValidQuery(queryEmbedding));
    if (!(await this.semanticFirewallService.isValidQuery(queryEmbedding))) {
      throw new ForbiddenException('Query has low relevance');
    }
    const cachedResponse = await this.semanticCacheService.findRelevantByEmbedding(queryEmbedding);
    console.log('CACHED RESPONSE:', cachedResponse);
    if (cachedResponse) {
      const query = await this.create(dto.text);
      query.response = cachedResponse;
      await this.repo.save(query);
      await this.requestLogService.logCachedQuery({
        startTime: new Date(),
        queryId: query.id,
      });
      console.log('LOGGED CACHED QUE');
      return {
        type: 'completed',
        data: { event: 'completed', cached: true, returnvalue: cachedResponse.text },
      } as MessageEvent<{ event: string; cached: boolean; returnvalue: string }>;
    }
    const jobId = await this.bullmqManager.addQuery({ text: dto.text });
    const createRequestLogDto: CreateRequestLogDto = {
      startTime: new Date(),
      requestText: dto.text, 
      embedding: queryEmbedding,
    };
    console.log('CREATE REQUEST LOG DTO:', createRequestLogDto);
    await this.redisService.setRequestLog(jobId, createRequestLogDto, QUERY_TTL);
    return jobId;
  }

  private createSseStream(jobId: string): Observable<MessageEvent> {
    const progressStream = fromEvent(this.eventEmitter, EVENT_PROGRESS).pipe(
      filter((p: any) => p.jobId === jobId),
      tap((p: any) => console.log('PROGRESS:', p)),
      map((p: any) => ({ type: 'progress', data: { event: 'progress', progress: p.progress } }))
    );

    const completedStream = fromEvent(this.eventEmitter, EVENT_COMPLETED).pipe(
      filter((p: any) => p.jobId === jobId),
      tap((p: any) => console.log('COMPLETED:', p)),
      tap((p: any) => this.saveResponse(jobId, p.returnvalue)),
      map((p: any) => ({ type: 'completed', data: { event: 'completed', returnvalue: p.returnvalue } }))
    );

    const failedStream = fromEvent(this.eventEmitter, EVENT_FAILED).pipe(
      filter((p: any) => p.jobId === jobId),
      tap((p: any) => console.log('FAILED:', p)),
      map((p: any) => ({ type: 'failed', data: { event: 'failed', jobId, failedReason: p.failedReason } }))
    );
    const mergedStream = progressStream.pipe(mergeWith(completedStream)).pipe(mergeWith(failedStream));
    return mergedStream.pipe(
      takeWhile((e: any) => e.type !== 'completed' && e.type !== 'failed', true),
      finalize(() => {
        console.log(`Stream for job ${jobId} closed`);
      }),
      map((e: any) => e)
    );
  }
}
