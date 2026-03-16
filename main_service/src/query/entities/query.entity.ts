import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RequestLog } from '../../request-log/entities/request-log.entity';
import { Response } from '../../response/entities/response.entity';

@Entity({ name: 'queries' })
export class Query {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  text: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToOne(() => RequestLog, (log) => log.query)
  @JoinColumn({ name: 'request_log_id' })
  requestLog: RequestLog;

  @ManyToOne(() => Response, (response) => response.queries, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'response_id' })
  response: Response;

  @Column({ type: 'boolean', name: 'is_primary', default: false })
  isPrimary: boolean;
}
