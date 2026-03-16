import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Query } from '../../query/entities/query.entity';

@Entity({ name: 'request_logs' })
export class RequestLog {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Query, (query) => query.requestLog, { onDelete: 'CASCADE' })
  query: Query;

  @Column({ type: 'varchar', length: 20 })
  source: string;

  @Column({ name: 'duration_ms', type: 'integer' })
  durationMs: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
