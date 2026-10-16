import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { APP_CONFIG } from '../config/app-config';
import type { AppConfig } from '../config/app-config';
import { installPgTypeParsers } from './pg-types';

/** Anything that can run a query: the pool or a client inside a transaction. */
export interface Queryable {
  query<R extends QueryResultRow = any>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
}

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly pool: Pool;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    installPgTypeParsers();
    this.pool = new Pool({ ...config.db, max: 10 });
  }

  async query<R extends QueryResultRow = any>(
    text: string,
    params: unknown[] = [],
  ): Promise<R[]> {
    const res = await this.pool.query<R>(text, params);
    return res.rows;
  }

  async one<R extends QueryResultRow = any>(
    text: string,
    params: unknown[] = [],
  ): Promise<R | null> {
    const rows = await this.query<R>(text, params);
    return rows[0] ?? null;
  }

  /** Runs fn inside BEGIN/COMMIT; rolls back on error. */
  async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

/** pg error code helpers */
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FK_VIOLATION = '23503';
export function pgCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String(err.code)
    : undefined;
}

/** numeric columns arrive as strings; convert at the repository boundary. */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}
export function numOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : num(v);
}
export function iso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  return v instanceof Date ? v.toISOString() : JSON.stringify(v);
}
