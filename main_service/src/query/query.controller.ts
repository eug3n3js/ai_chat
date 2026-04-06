import {
  Controller,
  Sse,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QueryService } from './query.service';
import { SseStreamQueryDto } from './dto/sse-stream-query.dto';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { TokenBucketGuard } from 'src/common/guards/token-bucket.guard';

@Controller('queries')
export class QueryController {
  constructor(
    private readonly queryService: QueryService,
  ) {}

  @UseGuards(TokenBucketGuard)
  @Sse('sse')
  proccessQuery(@Query() dto: SseStreamQueryDto): Observable<MessageEvent> {
    return this.queryService.proccessQuery(dto);
  }

}
