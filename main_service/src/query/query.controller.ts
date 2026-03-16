import {
  Controller,
  Sse,
  Query,
} from '@nestjs/common';
import { QueryService } from './query.service';
import { SseStreamQueryDto } from './dto/sse-stream-query.dto';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';

@Controller('queries')
export class QueryController {
  constructor(
    private readonly queryService: QueryService,
  ) {}

  @Sse('sse')
  proccessQuery(@Query() dto: SseStreamQueryDto): Observable<MessageEvent> {
    return this.queryService.proccessQuery(dto);
  }

}
