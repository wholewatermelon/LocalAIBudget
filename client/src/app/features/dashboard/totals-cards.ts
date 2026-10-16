import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { BudgetSummary } from '../../core/models';

@Component({
  selector: 'app-totals-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatIconModule, CurrencyPipe],
  template: `
    <mat-card appearance="outlined" class="card">
      <div class="label"><mat-icon>south_west</mat-icon> Income</div>
      <div class="value money-pos" data-testid="total-income">
        {{ summary().totalIncome | currency }}
      </div>
    </mat-card>
    <mat-card appearance="outlined" class="card">
      <div class="label"><mat-icon>north_east</mat-icon> Spent</div>
      <div class="value" data-testid="total-spent">{{ summary().totalSpent | currency }}</div>
    </mat-card>
    <mat-card appearance="outlined" class="card">
      <div class="label"><mat-icon>account_balance</mat-icon> Net</div>
      <div class="value" [class.money-pos]="summary().net >= 0" [class.negative]="summary().net < 0" data-testid="total-net">
        {{ summary().net | currency }}
      </div>
    </mat-card>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr));
      gap: 12px;
    }
    .card {
      padding: 16px;
    }
    .label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }
    .value {
      font: var(--mat-sys-headline-medium);
      margin-top: 4px;
    }
    .negative {
      color: var(--mat-sys-error);
    }
  `,
})
export class TotalsCards {
  readonly summary = input.required<BudgetSummary>();
}
