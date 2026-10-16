import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Shared by main.ts and e2e tests so both run the exact same pipeline. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
  });
  app.enableShutdownHooks();
  return app;
}
