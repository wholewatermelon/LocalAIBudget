import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { LLM_CLIENT } from './llm-client';
import { OllamaLlmClient } from './ollama-llm.client';

/** Provides LLM_CLIENT. Tests override it: `.overrideProvider(LLM_CLIENT).useValue(fake)`. */
@Global()
@Module({
  providers: [
    {
      provide: LLM_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) =>
        new OllamaLlmClient(
          cfg.ollamaHost,
          cfg.ollamaModel,
          cfg.ollamaTimeoutMs,
          undefined,
          cfg.ollamaKeepAlive,
        ),
    },
  ],
  exports: [LLM_CLIENT],
})
export class LlmModule {}
