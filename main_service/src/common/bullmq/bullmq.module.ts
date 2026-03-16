import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullmqManagerService } from './bullmq-manager.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'llm-service' }),
  ],
  providers: [BullmqManagerService],
  exports: [BullmqManagerService],
})
export class BullmqModule {}
