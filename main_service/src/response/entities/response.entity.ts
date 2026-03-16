import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Query } from '../../query/entities/query.entity';

@Entity({ name: 'responses' })
export class Response {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToMany(() => Query, (query) => query.response)
  queries: Query[];

  @Column('text')
  text: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
