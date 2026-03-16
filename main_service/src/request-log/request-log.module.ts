import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestLogService } from './request-log.service';
import { RequestLog } from './entities/request-log.entity';
import { Query } from 'src/query/entities/query.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RequestLog, Query])],
  providers: [RequestLogService],
  exports: [RequestLogService],
})
export class RequestLogModule {}
