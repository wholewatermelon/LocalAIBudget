import * as path from 'path';

/** Repo root: server/src/config (or server/dist/config) → ../../.. */
export const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
export const SERVER_ROOT = path.resolve(__dirname, '..', '..');
export const ENV_FILE = path.join(REPO_ROOT, '.env');
export const MIGRATIONS_DIR = path.join(SERVER_ROOT, 'db', 'migrations');

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface AppConfig {
  port: number;
  db: DbConfig;
  dbNameTest: string;
  ollamaHost: string;
  ollamaModel: string;
  /** Per-call LLM timeout (OLLAMA_TIMEOUT_MS). */
  ollamaTimeoutMs: number;
  /** How long Ollama keeps the model loaded after a call (OLLAMA_KEEP_ALIVE, Ollama duration syntax). */
  ollamaKeepAlive: string;
  statementsDir: string;
}

/** Builds the typed config from an env map (process.env after .env was loaded). Defaults per ARCHITECTURE.md. */
export function buildConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const statementsDir = env.STATEMENTS_DIR
    ? path.resolve(REPO_ROOT, env.STATEMENTS_DIR)
    : path.join(REPO_ROOT, 'data', 'statements');
  return {
    port: Number(env.PORT ?? 3000),
    db: {
      host: env.DB_HOST ?? 'localhost',
      port: Number(env.DB_PORT ?? 5432),
      user: env.DB_USER ?? 'postgres',
      password: env.DB_PASSWORD ?? '',
      database: env.DB_NAME ?? 'localaibudget',
    },
    dbNameTest: env.DB_NAME_TEST ?? 'localaibudget_test',
    ollamaHost: env.OLLAMA_HOST ?? 'http://127.0.0.1:11434',
    ollamaModel: env.OLLAMA_MODEL ?? 'gemma4',
    ollamaTimeoutMs:
      Number(env.OLLAMA_TIMEOUT_MS) > 0
        ? Number(env.OLLAMA_TIMEOUT_MS)
        : 180000,
    ollamaKeepAlive: env.OLLAMA_KEEP_ALIVE ?? '60m',
    statementsDir,
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
