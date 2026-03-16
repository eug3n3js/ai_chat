import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Query } from '../query/entities/query.entity';
import { Response } from './entities/response.entity';
import { ResponseService } from './response.service';

@Module({
  imports: [TypeOrmModule.forFeature([Response, Query])],
  providers: [ResponseService],
  exports: [ResponseService],
})
export class ResponseModule {}
