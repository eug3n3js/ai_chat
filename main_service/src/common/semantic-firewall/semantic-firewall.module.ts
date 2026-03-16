import { Module } from '@nestjs/common';
import { SemanticFirewallService } from './semantic-firewall.service';
import { ChromaModule } from '../chroma/chroma.module';
import { EmbeddingModelModule } from '../embedding-model/embedding-model.module';

@Module({
  imports: [ChromaModule, EmbeddingModelModule],
  providers: [SemanticFirewallService],
  exports: [SemanticFirewallService],
})
export class SemanticFirewallModule {}
