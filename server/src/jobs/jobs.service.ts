import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { DbService, iso, pgCode, PG_UNIQUE_VIOLATION } from '../db/db.service';
import { LlmUnavailableError } from '../llm/llm-client';
import {
  JobCounters,
  JobError,
  ProcessingService,
  ProcessMode,
} from '../processing/processing.service';

export interface Job {
  id: number;
  type: string;
  month: string;
  mode: ProcessMode;
  status: 'queued' | 'running' | 'completed' | 'failed';
  total: number;
  processed: number;
  inserted: number;
  skippedDuplicates: number;
  categorized: number;
  rulesApplied: number;
  transfersMatched: number;
  message: string | null;
  errors: JobError[];
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string | null;
}

function toJob(r: any): Job {
  return {
    id: r.id,
    type: r.type,
    month: r.month,
    mode: r.mode,
    status: r.status,
    total: r.total ?? 0,
    processed: r.processed ?? 0,
    inserted: r.inserted ?? 0,
    skippedDuplicates: r.skipped_duplicates ?? 0,
    categorized: r.categorized ?? 0,
    rulesApplied: r.rules_applied ?? 0,
    transfersMatched: r.transfers_matched ?? 0,
    message: r.message,
    errors: r.errors ?? [],
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
    createdAt: iso(r.created_at),
  };
}

/**
 * In-process background job runner. One queued/running job per month (enforced by a partial unique index →
 * 409). Progress is persisted to processing_jobs so the UI can poll. Stale jobs are failed on boot.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobsService.name);
  private readonly running = new Map<number, Promise<void>>();

  constructor(
    private readonly db: DbService,
    private readonly processing: ProcessingService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const rows = await this.db.query(
      `UPDATE processing_jobs SET status = 'failed', message = 'Server restarted', finished_at = now()
       WHERE status IN ('queued', 'running') RETURNING id`,
    );
    if (rows.length)
      this.logger.warn(`Marked ${rows.length} stale job(s) as failed`);
  }

  async start(month: string, mode: ProcessMode = 'incremental'): Promise<Job> {
    let job: Job;
    try {
      const r = await this.db.one(
        `INSERT INTO processing_jobs (type, month, mode, status) VALUES ('process_month', $1, $2, 'queued') RETURNING *`,
        [month, mode],
      );
      job = toJob(r);
    } catch (err) {
      if (pgCode(err) === PG_UNIQUE_VIOLATION)
        throw new ConflictException(
          `A job for ${month} is already queued or running`,
        );
      throw err;
    }
    const p = new Promise<void>((resolve) => setImmediate(resolve))
      .then(() => this.run(job))
      .finally(() => this.running.delete(job.id));
    this.running.set(job.id, p);
    return job;
  }

  /** Resolves when every in-flight job has finished (used by tests and shutdown). */
  async waitForIdle(): Promise<void> {
    while (this.running.size) await Promise.all([...this.running.values()]);
  }

  private async run(job: Job): Promise<void> {
    const counters: JobCounters = {
      total: 0,
      processed: 0,
      inserted: 0,
      skippedDuplicates: 0,
      categorized: 0,
      rulesApplied: 0,
      transfersMatched: 0,
      errors: [],
    };
    const save = (extra = '', params: unknown[] = []) =>
      this.db.query(
        `UPDATE processing_jobs SET total = $2, processed = $3, inserted = $4, skipped_duplicates = $5, categorized = $6,
           rules_applied = $7, transfers_matched = $8, errors = $9::jsonb ${extra} WHERE id = $1`,
        [
          job.id,
          counters.total,
          counters.processed,
          counters.inserted,
          counters.skippedDuplicates,
          counters.categorized,
          counters.rulesApplied,
          counters.transfersMatched,
          JSON.stringify(counters.errors),
          ...params,
        ],
      );
    try {
      await this.db.query(
        `UPDATE processing_jobs SET status = 'running', started_at = now() WHERE id = $1`,
        [job.id],
      );
      const message = await this.processing.processMonth(job.month, job.mode, {
        counters,
        flush: () => save().then(() => undefined),
      });
      await save(`, status = 'completed', message = $10, finished_at = now()`, [
        message,
      ]);
      this.logger.log(
        `Job ${job.id} (${job.month}, ${job.mode}) completed: ${message}`,
      );
    } catch (err) {
      const message =
        err instanceof LlmUnavailableError
          ? err.message
          : `Processing failed: ${(err as Error).message ?? String(err)}`;
      this.logger.error(`Job ${job.id} failed: ${message}`);
      await save(`, status = 'failed', message = $10, finished_at = now()`, [
        message,
      ]).catch((e: Error) =>
        this.logger.error(
          `Could not persist failure of job ${job.id}: ${e.message}`,
        ),
      );
    }
  }

  async get(id: number): Promise<Job> {
    const r = await this.db.one('SELECT * FROM processing_jobs WHERE id = $1', [
      id,
    ]);
    if (!r) throw new NotFoundException(`Job ${id} not found`);
    return toJob(r);
  }

  async list(month?: string, limit = 20): Promise<Job[]> {
    const rows = await this.db.query(
      `SELECT * FROM processing_jobs WHERE ($1::text IS NULL OR month = $1) ORDER BY created_at DESC, id DESC LIMIT $2`,
      [month ?? null, limit],
    );
    return rows.map(toJob);
  }
}
