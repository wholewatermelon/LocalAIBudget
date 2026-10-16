import { Controller, Get, Inject } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { LLM_CLIENT } from '../llm/llm-client';
import type { LlmClient } from '../llm/llm-client';

export interface Health {
  db: 'ok' | 'error';
  ollama: 'ok' | 'error';
  model: string;
  modelAvailable: boolean;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DbService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
  ) {}

  @Get()
  async health(): Promise<Health> {
    const [db, llm] = await Promise.all([
      this.db.query('SELECT 1').then(
        () => 'ok' as const,
        () => 'error' as const,
      ),
      this.llm.health(),
    ]);
    return {
      db,
      ollama: llm.reachable ? 'ok' : 'error',
      model: this.llm.model,
      modelAvailable: llm.modelAvailable,
    };
  }
}
