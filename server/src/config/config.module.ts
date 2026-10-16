import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_CONFIG, AppConfig, buildConfig, ENV_FILE } from './app-config';

/**
 * Loads the repo-root `.env` via @nestjs/config (real env vars win over .env values),
 * then exposes a typed `AppConfig` under the APP_CONFIG token.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ENV_FILE,
      isGlobal: true,
      cache: false,
    }),
  ],
  providers: [
    {
      provide: APP_CONFIG,
      inject: [ConfigService],
      // Injecting ConfigService guarantees .env has been loaded into process.env first.
      useFactory: (): AppConfig => buildConfig(process.env),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
