import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { Subscription, catchError, forkJoin, of } from 'rxjs';
import { BudgetApi } from '../../core/api/budget.api';
import { BudgetPlanApi } from '../../core/api/budget-plan.api';
import { isTransfer, isTransferCategory } from '../../core/category-utils';
import { CategoryStore } from '../../core/category.store';
import { BudgetSummary, Month, MonthBudgetSource, TrendPoint } from '../../core/models';
import { MonthService } from '../../core/month.service';
import { formatMonth } from '../../core/month-utils';
import { BudgetBars } from './budget-bars';
import { InsightsPanel } from './insights-panel';
import { TotalsCards } from './totals-cards';
import { TrendChart } from './trend-chart';

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TotalsCards,
    BudgetBars,
    InsightsPanel,
    TrendChart,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Dashboard{{ month() ? ' · ' + monthLabel() : '' }}</h1>
      </div>

      @if (loading() && !summary()) {
        <div class="loading-state"><mat-spinner diameter="40" /></div>
      } @else if (summary(); as s) {
        @if (uncategorizedCount() > 0 || s.uncategorizedSpent > 0) {
          <a
            class="warning"
            routerLink="/transactions"
            [queryParams]="{ month: month(), uncategorized: 'true' }"
            data-testid="uncategorized-warning"
          >
            <mat-icon>warning</mat-icon>
            <span>
              @if (uncategorizedCount() > 0) {
                {{ uncategorizedCount() }} uncategorized transaction{{ uncategorizedCount() === 1 ? '' : 's' }}
              } @else {
                Uncategorized spending
              }
              ({{ s.uncategorizedSpent | currency }}) — review them
            </span>
            <mat-icon>chevron_right</mat-icon>
          </a>
        }

        @if (reconciliationIssues() > 0) {
          <a
            class="warning"
            routerLink="/process"
            [queryParams]="{ month: month() }"
            data-testid="reconciliation-warning"
          >
            <mat-icon>rule</mat-icon>
            <span>
              {{ reconciliationIssues() }} statement file{{ reconciliationIssues() === 1 ? " doesn't" : "s don't" }}
              reconcile with the statement balances — rows may be missing
            </span>
            <mat-icon>chevron_right</mat-icon>
          </a>
        }
        @if (needsReviewCount() > 0) {
          <a
            class="notice"
            routerLink="/transactions"
            [queryParams]="{ month: month(), needsReview: 'true' }"
            data-testid="needs-review-link"
          >
            <mat-icon>fact_check</mat-icon>
            <span>
              {{ needsReviewCount() }} transaction{{ needsReviewCount() === 1 ? '' : 's' }} need{{ needsReviewCount() === 1 ? 's' : '' }} review
            </span>
            <mat-icon>chevron_right</mat-icon>
          </a>
        }

        <app-totals-cards [summary]="s" />

        <div class="grid">
          <mat-card appearance="outlined" class="budgets">
            <mat-card-header><mat-card-title>Budgets</mat-card-title></mat-card-header>
            <mat-card-content>
              <app-budget-bars [categories]="s.categories" [sources]="sources()" />
            </mat-card-content>
          </mat-card>

          <div class="side">
            <app-insights-panel [month]="month()" [budgets]="budgets()" (changed)="reload()" />
            <mat-card appearance="outlined">
              <mat-card-header><mat-card-title>Last 6 months</mat-card-title></mat-card-header>
              <mat-card-content>
                <app-trend-chart [points]="trend()" [exclude]="excludeFromTrend()" />
              </mat-card-content>
            </mat-card>
          </div>
        </div>
      } @else if (!loading()) {
        <div class="empty-state">
          <mat-icon>inbox</mat-icon>
          <p>No data for this month yet.</p>
          <a mat-flat-button routerLink="/process" queryParamsHandling="preserve">Upload &amp; process statements</a>
        </div>
      }
    </div>
  `,
  styles: `
    .warning,
    .notice {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      border-radius: 12px;
      text-decoration: none;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      span {
        flex: 1;
      }
    }
    .notice {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 16px;
      margin-top: 16px;
      align-items: start;
    }
    .side {
      display: grid;
      gap: 16px;
    }
    @media (max-width: 1023px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class DashboardPage {
  private readonly budget = inject(BudgetApi);
  private readonly months = inject(MonthService);
  private readonly categories = inject(CategoryStore);
  private readonly budgetPlan = inject(BudgetPlanApi);

  protected readonly month = this.months.selected;
  protected readonly monthLabel = computed(() => formatMonth(this.month() ?? ''));
  protected readonly summary = signal<BudgetSummary | null>(null);
  protected readonly trend = signal<TrendPoint[]>([]);
  /** Section H month view sources (adjusted / month-only markers). Empty if the endpoint fails. */
  protected readonly sources = signal<ReadonlyMap<number, MonthBudgetSource>>(new Map());
  protected readonly budgets = computed<ReadonlyMap<number, number | null>>(
    () => new Map((this.summary()?.categories ?? []).map((c) => [c.categoryId, c.budgetLimit])),
  );
  protected readonly loading = signal(false);
  protected readonly uncategorizedCount = computed(
    () => this.months.selectedSummary()?.uncategorizedCount ?? 0,
  );

  protected readonly reconciliationIssues = computed(
    () => this.months.selectedSummary()?.reconciliationIssues ?? 0,
  );
  protected readonly needsReviewCount = computed(
    () => this.months.selectedSummary()?.needsReviewCount ?? 0,
  );

  /** Leave income + transfer categories out of the spending stacks. */
  protected readonly excludeFromTrend = computed(() => {
    // Trend keys are category names: look the category up and use its flags; name check only for unknown names.
    const byName = new Map(this.categories.categories().map((c) => [c.name, c]));
    return (name: string) => {
      const c = byName.get(name);
      return c ? c.isIncome || isTransfer(c) : isTransferCategory(name);
    };
  });

  private sub?: Subscription;

  constructor() {
    this.categories.ensureLoaded();
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe());
    effect(() => {
      const m = this.month();
      untracked(() => this.load(m));
    });
  }

  reload(): void {
    this.load(this.month());
  }

  private load(month: Month | null): void {
    this.sub?.unsubscribe();
    if (!month) return;
    this.loading.set(true);
    // Keep the warning counts (uncategorized / review / reconciliation) fresh whenever the dashboard loads.
    this.months.refreshMonths();
    this.sub = forkJoin({
      summary: this.budget.summary(month),
      trend: this.budget.trend(6, month),
      monthView: this.budgetPlan.month(month, true).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ summary, trend, monthView }) => {
        this.summary.set(summary);
        this.trend.set(trend);
        this.sources.set(new Map((monthView?.items ?? []).map((i) => [i.categoryId, i.source])));
        this.loading.set(false);
      },
      error: () => {
        this.summary.set(null);
        this.loading.set(false);
      },
    });
  }
}
