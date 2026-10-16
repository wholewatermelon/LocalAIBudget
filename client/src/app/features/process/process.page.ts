import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, Subscription, filter, forkJoin, map } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { JobsApi } from '../../core/api/jobs.api';
import { CategoryStore } from '../../core/category.store';
import { StatementsApi } from '../../core/api/statements.api';
import { isActive, pollJob } from '../../core/job-polling';
import { Job, JobMode, Month, StatementFile } from '../../core/models';
import { MonthService } from '../../core/month.service';
import { formatMonth } from '../../core/month-utils';
import { NotifyService } from '../../core/notify.service';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog';
import { JobHistory } from './job-history';
import { JobProgress } from './job-progress';
import { StatementList } from './statement-list';
import { UploadZone, partitionFiles } from './upload-zone';

/** Mirrors the server: a YYYY-MM in the filename (not followed by another digit) decides the month. */
export const MONTH_IN_NAME = /\d{4}-(0[1-9]|1[0-2])(?!\d)/;

export const RECATEGORIZE_CONFIRM: ConfirmDialogData = {
  title: 'Re-categorize this month?',
  message:
    'The AI will re-run on every transaction in this month.\n\n' +
    'Your manual corrections and split transactions are kept — the AI never overwrites them.',
  confirmText: 'Re-categorize',
};

@Component({
  selector: 'app-process-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    UploadZone,
    StatementList,
    JobProgress,
    JobHistory,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Process statements · {{ monthLabel() }}</h1>
        <button
          mat-flat-button
          (click)="process('incremental')"
          [disabled]="!month() || busy()"
          data-testid="process-btn"
        >
          <mat-icon>play_arrow</mat-icon> Process month
        </button>
        <button
          mat-stroked-button
          (click)="confirmRecategorize()"
          [disabled]="!month() || busy()"
          data-testid="recategorize-btn"
        >
          <mat-icon>auto_fix_high</mat-icon> Re-categorize month
        </button>
      </div>

      @if (job(); as j) {
        <app-job-progress [job]="j" class="block" />
      }

      <app-upload-zone
        class="block"
        [month]="month()"
        [uploading]="uploading()"
        (filesSelected)="upload($event)"
      />

      <mat-card appearance="outlined" class="block">
        <mat-card-header><mat-card-title>Statement files</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (filesLoading()) {
            <div class="loading-state"><mat-spinner diameter="32" /></div>
          } @else {
            <app-statement-list [files]="files()" [disabled]="busy()" (remove)="deleteFile($event)" />
          }
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined" class="block">
        <mat-card-header><mat-card-title>Job history</mat-card-title></mat-card-header>
        <mat-card-content>
          <app-job-history [jobs]="jobs()" />
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .block {
      display: block;
      margin-bottom: 16px;
    }
  `,
})
export class ProcessPage {
  private readonly statements = inject(StatementsApi);
  private readonly jobsApi = inject(JobsApi);
  private readonly monthSvc = inject(MonthService);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);
  private readonly categoryStore = inject(CategoryStore);

  protected readonly month = this.monthSvc.selected;
  protected readonly monthLabel = computed(() => formatMonth(this.month() ?? ''));
  protected readonly files = signal<StatementFile[]>([]);
  protected readonly filesLoading = signal(false);
  protected readonly jobs = signal<Job[]>([]);
  protected readonly job = signal<Job | null>(null);
  protected readonly uploading = signal(false);
  protected readonly starting = signal(false);
  protected readonly busy = computed(
    () => this.uploading() || this.starting() || (!!this.job() && isActive(this.job()!.status)),
  );

  private loadSub?: Subscription;
  private pollSub?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.loadSub?.unsubscribe();
      this.pollSub?.unsubscribe();
    });
    effect(() => {
      const m = this.month();
      untracked(() => this.load(m));
    });
  }

  private load(month: Month | null): void {
    this.loadSub?.unsubscribe();
    this.pollSub?.unsubscribe();
    this.job.set(null);
    if (!month) return;
    this.filesLoading.set(true);
    this.loadSub = forkJoin({
      files: this.statements.list(month),
      jobs: this.jobsApi.list(month),
    }).subscribe({
      next: ({ files, jobs }) => {
        this.files.set(files);
        this.jobs.set(jobs);
        this.filesLoading.set(false);
        // Resume live progress if a job for this month is still running (e.g. after navigating away).
        const active = jobs.find((j) => isActive(j.status));
        if (active) this.track(active);
      },
      error: () => this.filesLoading.set(false),
    });
  }

  private refreshFilesAndJobs(month: Month): void {
    this.statements.list(month).subscribe((f) => this.files.set(f));
    this.jobsApi.list(month).subscribe((j) => this.jobs.set(j));
  }

  upload(selected: File[]): void {
    const month = this.month();
    const { accepted, rejected } = partitionFiles(selected);
    if (rejected.length) {
      this.notify.error(`Skipped: ${rejected.map((r) => `${r.name} (${r.reason})`).join(', ')}`);
    }
    if (!accepted.length) return;
    // Files named with a YYYY-MM go to that month (server rule); others go to the selected month.
    const named = accepted.filter((f) => MONTH_IN_NAME.test(f.name));
    const unnamed = accepted.filter((f) => !MONTH_IN_NAME.test(f.name));
    const calls: Observable<StatementFile[]>[] = [];
    if (named.length) calls.push(this.statements.upload(named));
    if (unnamed.length) calls.push(this.statements.upload(unnamed, month));
    this.uploading.set(true);
    forkJoin(calls)
      .pipe(map((r) => r.flat()))
      .subscribe({
        next: (uploaded) => {
          this.uploading.set(false);
          const elsewhere = [...new Set(uploaded.map((f) => f.month).filter((m) => m !== month))];
          this.notify.info(
            `Uploaded ${uploaded.length} file${uploaded.length === 1 ? '' : 's'}` +
              (elsewhere.length ? ` (into ${elsewhere.join(', ')})` : ''),
          );
          this.monthSvc.refreshMonths();
          if (month) this.refreshFilesAndJobs(month);
        },
        error: () => this.uploading.set(false),
      });
  }

  deleteFile(file: StatementFile): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete ${file.fileName}?`,
          message: 'The file is removed from disk. Transactions already imported from it are kept.',
          confirmText: 'Delete',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .pipe(filter((ok) => ok === true))
      .subscribe(() =>
        this.statements.delete(file.id).subscribe(() => {
          this.files.update((list) => list.filter((f) => f.id !== file.id));
          this.monthSvc.refreshMonths();
          this.notify.info(`Deleted ${file.fileName}`);
        }),
      );
  }

  confirmRecategorize(): void {
    this.dialog
      .open(ConfirmDialog, { data: RECATEGORIZE_CONFIRM })
      .afterClosed()
      .pipe(filter((ok) => ok === true))
      .subscribe(() => this.process('recategorize'));
  }

  process(mode: JobMode): void {
    const month = this.month();
    if (!month || this.busy()) return;
    this.starting.set(true);
    this.jobsApi.process(month, mode).subscribe({
      next: (job) => {
        this.starting.set(false);
        this.jobs.update((list) => [job, ...list.filter((j) => j.id !== job.id)]);
        this.track(job);
      },
      error: (err: unknown) => {
        this.starting.set(false);
        if (err instanceof HttpErrorResponse && err.status === 409) {
          // A job is already queued/running for this month: pick it up so progress shows and buttons disable.
          this.resumeActiveJob(month);
        } else {
          this.refreshFilesAndJobs(month);
        }
      },
    });
  }

  private resumeActiveJob(month: Month): void {
    this.jobsApi.list(month).subscribe((jobs) => {
      this.jobs.set(jobs);
      const active = jobs.find((j) => isActive(j.status));
      if (active && this.month() === month) this.track(active);
    });
  }

  /** Poll every 1s until completed/failed; then refresh files, history and the global months list. */
  private track(start: Job): void {
    this.pollSub?.unsubscribe();
    this.job.set(start);
    const month = start.month;
    this.pollSub = pollJob((id) => this.jobsApi.get(id), start.id).subscribe({
      next: (job) => {
        this.job.set(job);
        this.jobs.update((list) => list.map((j) => (j.id === job.id ? job : j)));
        if (job.status === 'completed' || job.status === 'failed') {
          if (job.status === 'completed') this.notify.info(`Finished processing ${month}`);
          this.monthSvc.refreshMonths();
          this.categoryStore.load(); // transactionCount per category changed
          if (this.month() === month) this.refreshFilesAndJobs(month);
        }
      },
    });
  }
}

