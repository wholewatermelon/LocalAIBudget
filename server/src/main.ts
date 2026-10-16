import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { APP_CONFIG } from './config/app-config';
import type { AppConfig } from './config/app-config';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  const cfg = app.get<AppConfig>(APP_CONFIG);
  // Local-only app: bind to loopback, never to all interfaces.
  await app.listen(cfg.port, '127.0.0.1');
  Logger.log(
    `API on http://127.0.0.1:${cfg.port}/api (db ${cfg.db.database}, model ${cfg.ollamaModel}, statements ${cfg.statementsDir})`,
    'Bootstrap',
  );
}
void bootstrap();
