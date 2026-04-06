import {
  InjectQueue,
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

const QUEUE_NAME = 'llm-service';
const TASK_NAME = 'llm-query';
const EVENT_COMPLETED = 'llm-query-completed';
const EVENT_PROGRESS = 'llm-query-progress';
const EVENT_FAILED = 'llm-query-failed';

@QueueEventsListener(QUEUE_NAME)
export class BullmqManagerService extends QueueEventsHost {
  constructor(
    @InjectQueue(QUEUE_NAME) private readonly queue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async addQuery(data: any): Promise<string> {
    const job = await this.queue.add(TASK_NAME, data);
    return job.id!;
  }

  @OnQueueEvent('progress')
  onProgress(payload: { jobId: string; data: any }) {
    this.eventEmitter.emit(EVENT_PROGRESS, {
      jobId: payload.jobId,
      progress: payload.data,
    });
  }

  @OnQueueEvent('completed')
  onCompleted(payload: { jobId: string; returnvalue: any }) {
    this.eventEmitter.emit(EVENT_COMPLETED, {
      jobId: payload.jobId,
      returnvalue: payload.returnvalue,
    });
  }

  @OnQueueEvent('failed')
  onFailed(payload: { jobId: string; failedReason: string }) {
    this.eventEmitter.emit(EVENT_FAILED, {
      jobId: payload.jobId,
      failedReason: payload.failedReason,
    });
  }
}
