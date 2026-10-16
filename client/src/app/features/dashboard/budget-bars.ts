import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { isNonSpendingCategory, isTransfer } from '../../core/category-utils';
import { BudgetCategory } from '../../core/models';
import { BudgetStatus, STATUS_LABEL, budgetStatus, percentUsed } from './budget-status';

interface BarRow {
  cat: BudgetCategory;
  status: BudgetStatus;
  pct: number | null;
  width: number;
}

const STATUS_ICON: Record<BudgetStatus, string> = {
  none: 'remove',
  ok: 'check_circle',
  warn: 'warning',
  over: 'error',
};

@Component({
  selector: 'app-budget-bars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DecimalPipe, MatIconModule],
  template: `
    @if (rows().length === 0) {
      <p class="empty-state">No spending categories for this month.</p>
    }
    @for (r of rows(); track r.cat.categoryId) {
      <div class="row" [attr.data-status]="r.status" data-testid="budget-row">
        <div class="head">
          <span class="name">{{ r.cat.name }}</span>
          <span class="amounts tabular">
            {{ r.cat.spent | currency }}
            @if (r.cat.budgetLimit > 0) {
              <span class="muted">/ {{ r.cat.budgetLimit | currency }}</span>
            }
          </span>
        </div>
        <div
          class="track"
          role="progressbar"
          [attr.aria-valuenow]="r.pct === null ? null : (r.pct | number: '1.0-0')"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-label]="r.cat.name + ' budget used'"
        >
          <div class="fill" [class]="'fill ' + r.status" [style.width.%]="r.width"></div>
        </div>
        <div class="foot">
          <span class="status" [class]="'status ' + r.status">
            <mat-icon>{{ icon[r.status] }}</mat-icon>{{ label[r.status] }}
            @if (r.pct !== null) {
              · {{ r.pct | number: '1.0-0' }}%
            }
          </span>
          @if (r.cat.budgetLimit > 0) {
            <span class="muted tabular">
              @if (r.cat.remaining >= 0) {
                {{ r.cat.remaining | currency }} left
              } @else {
                {{ -r.cat.remaining | currency }} over
              }
            </span>
          }
        </div>
      </div>
    }

    @if (nonSpending().length) {
      <h3 class="sub">Money in &amp; transfers</h3>
      @for (c of nonSpending(); track c.categoryId) {
        <div class="income-row" data-testid="non-spending-row">
          <span>{{ c.name }}</span>
          <span class="tabular" [class.money-pos]="c.isIncome && !isTransfer(c)">
            {{ c.spent | currency }}
            @if (isTransfer(c)) {
              <span class="muted">moved</span>
            } @else {
              <span class="muted">received</span>
            }
          </span>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .row {
      padding: 8px 0;
    }
    .head,
    .foot {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .name {
      font: var(--mat-sys-title-small);
    }
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
    .foot {
      font: var(--mat-sys-body-small);
      margin-top: 4px;
    }
    .track {
      height: 8px;
      border-radius: 4px;
      background: var(--mat-sys-surface-container-highest);
      overflow: hidden;
      margin-top: 6px;
    }
    .fill {
      height: 100%;
      border-radius: 4px;
      transition: width 300ms ease;
      background: var(--app-muted);
    }
    .fill.ok {
      background: var(--app-good);
    }
    .fill.warn {
      background: var(--app-warning);
    }
    .fill.over {
      background: var(--app-critical);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-on-surface-variant);
      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }
    .status.ok mat-icon {
      color: var(--app-good);
    }
    .status.warn mat-icon {
      color: var(--app-warning);
    }
    .status.over mat-icon {
      color: var(--app-critical);
    }
    .sub {
      font: var(--mat-sys-title-small);
      margin: 16px 0 4px;
      color: var(--mat-sys-on-surface-variant);
    }
    .income-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }
  `,
})
export class BudgetBars {
  readonly categories = input.required<BudgetCategory[]>();

  protected readonly icon = STATUS_ICON;
  protected readonly label = STATUS_LABEL;
  protected readonly isTransfer = isTransfer;

  protected readonly rows = computed<BarRow[]>(() =>
    this.categories()
      .filter((c) => !isNonSpendingCategory(c))
      .map((cat) => {
        const pct = percentUsed(cat.spent, cat.budgetLimit);
        return {
          cat,
          status: budgetStatus(cat.spent, cat.budgetLimit),
          pct,
          width: pct === null ? (cat.spent > 0 ? 100 : 0) : Math.min(100, pct),
        };
      })
      // Most-used first; categories without a limit last.
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.cat.spent - a.cat.spent),
  );

  protected readonly nonSpending = computed(() =>
    this.categories().filter((c) => isNonSpendingCategory(c)),
  );
}
