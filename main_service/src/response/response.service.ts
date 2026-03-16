import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Query } from '../query/entities/query.entity';
import { Response } from './entities/response.entity';

@Injectable()
export class ResponseService {
  constructor(
    @InjectRepository(Response)
    private readonly repo: Repository<Response>,
    @InjectRepository(Query)
    private readonly queryRepo: Repository<Query>,
  ) {}

  async create(queryId: string, responseText: string): Promise<Response> {
    return this.repo.manager.transaction(async (manager) => {
      const responseRepo = manager.getRepository(Response);
      const queryRepo = manager.getRepository(Query);

      const query = await queryRepo.findOne({ where: { id: queryId } });
      if (!query) {
        throw new NotFoundException(`Query with id ${queryId} not found`);
      }

      const response = responseRepo.create({ text: responseText, queries: [query] });
      return await responseRepo.save(response);
    });
  }


  async findOneById(id: string): Promise<Response | null> {
    return this.repo.findOne({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
