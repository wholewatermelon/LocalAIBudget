import { Observable, exhaustMap, takeWhile, timer } from 'rxjs';
import { Job, JobStatus } from './models';

export const JOB_POLL_INTERVAL_MS = 1000;

export function isTerminal(status: JobStatus): boolean {
  return status === 'completed' || status === 'failed';
}

export function isActive(status: JobStatus): boolean {
  return status === 'queued' || status === 'running';
}

/**
 * Polls a job every `intervalMs` (first request immediately) and completes after emitting the
 * first completed/failed job. `exhaustMap` skips ticks while a request is still in flight.
 * Unsubscribing (e.g. takeUntilDestroyed) cancels the timer and any in-flight request.
 */
export function pollJob(
  fetch: (id: number) => Observable<Job>,
  id: number,
  intervalMs = JOB_POLL_INTERVAL_MS,
): Observable<Job> {
  return timer(0, intervalMs).pipe(
    exhaustMap(() => fetch(id)),
    takeWhile((job) => !isTerminal(job.status), true),
  );
}

/**
 * Percent for a determinate bar, or null for an indeterminate one. Indeterminate while queued, when the
 * total is unknown, or when a running job has processed >= total (e.g. the server is still categorizing
 * work it didn't count up front) - never show a stuck "100%" while the job is still running.
 */
export function jobProgress(job: Pick<Job, 'total' | 'processed' | 'status'>): number | null {
  if (job.status === 'completed') return 100;
  if (job.status === 'queued') return null;
  if (!job.total || job.processed >= job.total) return null;
  return Math.max(0, Math.min(100, Math.round((job.processed / job.total) * 100)));
}
