import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, Subscription, catchError, map, of, throwError } from 'rxjs';
import { JobsApi } from '../../core/api/jobs.api';
import { isActive } from '../../core/job-polling';
import { InsightsApi } from '../../core/api/insights.api';
import { BudgetPlanApi } from '../../core/api/budget-plan.api';
import { errorMessage } from '../../core/http-context';
import { Insight, InsightSuggestion, Job, Month } from '../../core/models';
import { NotifyService } from '../../core/notify.service';

function isTimeout(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as Error).name === 'TimeoutError';
}

@Component({
  selector: 'app-insights-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatMenuModule, MatProgressSpinnerModule, CurrencyPipe, DatePipe],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-icon mat-card-avatar class="avatar">auto_awesome</mat-icon>
        <mat-card-title>AI insights</mat-card-title>
        @if (insight(); as i) {
          <mat-card-subtitle>
            {{ i.createdAt | date: 'medium' }}@if (i.model) { · {{ i.model }} }
          </mat-card-subtitle>
        }
      </mat-card-header>
      <mat-card-content>
        @if (generating()) {
          <div class="generating" data-testid="insights-generating">
            <mat-spinner diameter="28" />
            <span>
              @if (aiBusy()) {
                A statement-processing job is also using the local model, so this can take a few minutes…
              } @else {
                Asking the local model… this usually takes a minute or two.
              }
            </span>
          </div>
        } @else if (loading()) {
          <div class="loading-state"><mat-spinner diameter="28" /></div>
        } @else if (insight(); as i) {
          <p class="summary">{{ i.summary }}</p>
          @if (i.suggestions.length) {
            <h4>Suggested budget limits</h4>
            <ul class="suggestions">
              @for (s of i.suggestions; track s.categoryId) {
                <li data-testid="suggestion">
                  <div class="s-text">
                    <strong>{{ s.categoryName }}</strong>
                    <span class="tabular">
                      @if (currentLimit(s); as cur) {
                        {{ cur | currency }} →
                      }
                      {{ s.suggestedLimit | currency }}
                    </span>
                    <div class="reason">{{ s.reason }}</div>
                  </div>
                  @if (applied().get(s.categoryId); as how) {
                    <span class="applied"><mat-icon>check</mat-icon> {{ how }}</span>
                  } @else {
                    <button
                      mat-stroked-button
                      [matMenuTriggerFor]="applyMenu"
                      [matMenuTriggerData]="{ s: s }"
                      [disabled]="applying() === s.categoryId"
                      data-testid="apply"
                    >
                      Apply <mat-icon iconPositionEnd>arrow_drop_down</mat-icon>
                    </button>
                  }
                </li>
              }
            </ul>
          }
        } @else {
          <p class="empty-state">No insights for this month yet.</p>
        }
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
      </mat-card-content>
      <mat-menu #applyMenu="matMenu">
        <ng-template matMenuContent let-s="s">
          <button mat-menu-item (click)="applyThisMonth(s)" data-testid="apply-month">
            <mat-icon>event</mat-icon> Just this month
          </button>
          <button mat-menu-item (click)="applyMain(s)" data-testid="apply-main">
            <mat-icon>event_repeat</mat-icon> Main budget from this month on
          </button>
        </ng-template>
      </mat-menu>
      <mat-card-actions align="end">
        <button mat-flat-button (click)="generate()" [disabled]="generating() || !month()">
          <mat-icon>auto_awesome</mat-icon>
          {{ insight() ? 'Regenerate insights' : 'Generate insights' }}
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    .avatar {
      color: var(--mat-sys-primary);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .generating {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 0;
    }
    .summary {
      white-space: pre-line;
    }
    h4 {
      font: var(--mat-sys-title-small);
      margin: 16px 0 4px;
    }
    .suggestions {
      list-style: none;
      padding: 0;
      margin: 0;
      li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 0;
        border-top: 1px solid var(--mat-sys-outline-variant);
      }
    }
    .s-text strong {
      margin-right: 8px;
    }
    .reason {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .applied {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-primary);
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
})
export class InsightsPanel {
  private readonly api = inject(InsightsApi);
  private readonly budgetPlan = inject(BudgetPlanApi);
  private readonly notify = inject(NotifyService);
  private readonly jobsApi = inject(JobsApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly month = input.required<Month | null>();
  /** Effective budget per categoryId for the month (from the budget summary), shown as "current → suggested". */
  readonly budgets = input<ReadonlyMap<number, number | null>>(new Map());
  /** Emitted after a suggestion was applied (budget limits changed). */
  readonly changed = output<void>();

  protected readonly insight = signal<Insight | null>(null);
  protected readonly loading = signal(false);
  protected readonly generating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly applying = signal<number | null>(null);
  /** categoryId -> how it was applied ("This month" / "Main budget"). */
  protected readonly applied = signal<ReadonlyMap<number, string>>(new Map());
  /** True when a processing job is running (it competes for Ollama, so generation is slower). */
  protected readonly aiBusy = signal(false);

  private sub?: Subscription;

  constructor() {
    effect(() => {
      const m = this.month();
      untracked(() => this.load(m));
    });
  }

  protected currentLimit(s: InsightSuggestion): number | null {
    return this.budgets().get(s.categoryId) ?? null;
  }

  private load(month: Month | null): void {
    this.sub?.unsubscribe();
    this.insight.set(null);
    this.error.set(null);
    this.applied.set(new Map());
    this.generating.set(false);
    if (!month) return;
    this.loading.set(true);
    this.sub = this.api
      .latest(month)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (i) => {
          this.insight.set(i);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  generate(): void {
    const month = this.month();
    if (!month || this.generating()) return;
    this.sub?.unsubscribe();
    this.generating.set(true);
    this.error.set(null);
    this.aiBusy.set(false);
    this.jobsApi
      .list(null, 5, true)
      .pipe(catchError(() => of([] as Job[])), takeUntilDestroyed(this.destroyRef))
      .subscribe((jobs) => this.aiBusy.set(jobs.some((j) => isActive(j.status))));
    const before = this.insight();
    this.sub = this.api
      .generate(month)
      .pipe(
        // The server may still finish and save the insight after our timeout: look once before giving up.
        catchError((err: unknown) =>
          isTimeout(err)
            ? this.api.latest(month).pipe(
                map((latest) => {
                  if (latest && (!before || latest.id !== before.id)) return latest;
                  throw err;
                }),
              )
            : throwError(() => err),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (i) => {
          this.insight.set(i);
          this.applied.set(new Map());
          this.generating.set(false);
        },
        error: (err: unknown) => {
          this.generating.set(false);
          this.error.set(`Could not generate insights: ${errorMessage(err)}`);
        },
      });
  }

  /** Apply → "Just this month": PUT the month item (an adjustment for this month only). */
  applyThisMonth(s: InsightSuggestion): void {
    const month = this.month();
    if (!month) return;
    this.runApply(s, 'This month', this.budgetPlan.setMonthItem(month, s.categoryId, { amount: s.suggestedLimit }), `for ${month}`);
  }

  /** Apply → "Main budget from this month on": PUT a main version with effectiveFrom = month. */
  applyMain(s: InsightSuggestion): void {
    const month = this.month();
    if (!month) return;
    this.runApply(s, 'Main budget', this.budgetPlan.setMainItem(s.categoryId, s.suggestedLimit, month), `from ${month} on`);
  }

  private runApply(s: InsightSuggestion, how: string, req: Observable<unknown>, scope: string): void {
    this.applying.set(s.categoryId);
    req.subscribe({
      next: () => {
        this.applying.set(null);
        this.applied.update((m) => new Map(m).set(s.categoryId, how));
        this.notify.info(`${s.categoryName} budget set to $${s.suggestedLimit.toFixed(2)} ${scope}`);
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.applying.set(null);
        this.notify.error(err);
      },
    });
  }
}
