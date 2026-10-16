/* Jest globalSetup: create the e2e database if missing and apply all migrations. */
import * as dotenv from 'dotenv';
import {
  buildConfig,
  ENV_FILE,
  MIGRATIONS_DIR,
} from '../src/config/app-config';
import { ensureDatabase, runMigrations } from '../src/db/migrator';

export default async function globalSetup(): Promise<void> {
  dotenv.config({ path: ENV_FILE, quiet: true });
  const cfg = buildConfig(process.env);
  const db = { ...cfg.db, database: cfg.dbNameTest };
  if (db.database === cfg.db.database)
    throw new Error('DB_NAME_TEST must differ from DB_NAME');
  await ensureDatabase(db);
  await runMigrations(db, MIGRATIONS_DIR);
}
