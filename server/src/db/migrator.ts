import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { DbConfig } from '../config/app-config';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export function listMigrationFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();
}

/** Applies every not-yet-applied `NNN_name.sql` in order, each in its own transaction. */
export async function runMigrations(
  db: DbConfig,
  dir: string,
  log: (m: string) => void = () => {},
): Promise<MigrationResult> {
  const client = new Client(db);
  await client.connect();
  const result: MigrationResult = { applied: [], skipped: [] };
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
    );
    const done = new Set(
      (
        await client.query<{ name: string }>(
          'SELECT name FROM schema_migrations',
        )
      ).rows.map((r) => r.name),
    );
    for (const file of listMigrationFiles(dir)) {
      if (done.has(file)) {
        result.skipped.push(file);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      log(`Applying ${file} ...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [
          file,
        ]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
      result.applied.push(file);
    }
  } finally {
    await client.end();
  }
  return result;
}

/** Creates the database if it does not exist (connects to the `postgres` maintenance DB). */
export async function ensureDatabase(db: DbConfig): Promise<boolean> {
  if (!/^[A-Za-z0-9_]+$/.test(db.database))
    throw new Error(`Refusing unsafe database name`);
  const admin = new Client({ ...db, database: 'postgres' });
  await admin.connect();
  try {
    const exists = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [db.database],
    );
    if (exists.rowCount) return false;
    await admin.query(`CREATE DATABASE "${db.database}"`);
    return true;
  } finally {
    await admin.end();
  }
}

/** Drops and recreates the public schema (ALL DATA LOST). */
export async function resetSchema(db: DbConfig): Promise<void> {
  const client = new Client(db);
  await client.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  } finally {
    await client.end();
  }
}
