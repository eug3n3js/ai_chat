import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { DatabaseOperationError } from 'src/common/exceptions/database.exception';
import { Query } from '../query/entities/query.entity';
import { Response } from './entities/response.entity';

@Injectable()
export class ResponseService {
  private readonly logger = new Logger(ResponseService.name);

  constructor(
    @InjectRepository(Response)
    private readonly repo: Repository<Response>,
  ) {}

  private async run<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: unknown) {
      if (e instanceof NotFoundException || e instanceof DatabaseOperationError) {
        throw e;
      }
      this.logger.error(
        `[DB Response] ${operation}`,
        e instanceof Error ? e.stack : String(e),
      );
      throw new DatabaseOperationError('Response', operation, e);
    }
  }

  async create(queryId: string, responseText: string): Promise<Response> {
    return this.run<Response>('create', () =>
      this.repo.manager.transaction(async (manager) => {
        const responseRepo = manager.getRepository(Response);
        const queryRepo = manager.getRepository(Query);

        const query = await queryRepo.findOne({ where: { id: queryId } });
        if (!query) {
          throw new NotFoundException(`Query with id ${queryId} not found`);
        }

        const response = responseRepo.create({ text: responseText, queries: [query] });
        return await responseRepo.save(response);
      }),
    );
  }

  async findOneById(id: string): Promise<Response | null> {
    return await this.run<Response | null>('findOneById', async () => {
      return await this.repo.findOne({ where: { id } });
    });
  }

  async delete(id: string): Promise<void> {
    await this.run<DeleteResult>('delete', () => this.repo.delete(id));
  }
}
