import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TransactionsApi } from '../../core/api/transactions.api';
import { errorMessage } from '../../core/http-context';
import { Category, Transaction } from '../../core/models';
import { SplitDraft, fromCents, toCents, validateSplits } from './split-validation';

export interface SplitDialogData {
  transaction: Transaction;
  categories: Category[];
}

/** Closes with the updated Transaction on save/clear, or undefined on cancel. */
@Component({
  selector: 'app-split-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CurrencyPipe,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>Split transaction</h2>
    <mat-dialog-content>
      <p class="tx">
        <span>{{ tx.date }} · {{ tx.description }}</span>
        <strong class="tabular">{{ tx.amount | currency }}</strong>
      </p>

      @for (row of rows(); track $index; let i = $index) {
        <div class="row" data-testid="split-row">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="cat">
            <mat-label>Category</mat-label>
            <mat-select [ngModel]="row.categoryId" (ngModelChange)="patch(i, { categoryId: $event })">
              @for (c of data.categories; track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="amt">
            <mat-label>Amount</mat-label>
            <span matTextPrefix>$&nbsp;</span>
            <input
              matInput
              type="number"
              step="0.01"
              [ngModel]="row.amount"
              (ngModelChange)="patch(i, { amount: $event })"
              [attr.aria-label]="'Split ' + (i + 1) + ' amount'"
            />
          </mat-form-field>
          <button mat-icon-button (click)="fillRemaining(i)" matTooltip="Fill remaining" aria-label="Fill remaining">
            <mat-icon>vertical_align_bottom</mat-icon>
          </button>
          <button mat-icon-button (click)="removeRow(i)" matTooltip="Remove row" aria-label="Remove row">
            <mat-icon>close</mat-icon>
          </button>
          @if (submitted() || touched().has(i)) {
            @if (validation().rowErrors[i]; as err) {
              <div class="row-error">{{ err }}</div>
            }
          }
        </div>
      }

      <button mat-button (click)="addRow()"><mat-icon>add</mat-icon> Add split</button>

      <div class="remaining" [class.ok]="validation().remaining === 0" data-testid="remaining">
        Remaining: <strong class="tabular">{{ validation().remaining | currency }}</strong>
      </div>
      @if (rows().length) {
        @for (e of validation().errors; track e) {
          <p class="error">{{ e }}</p>
        }
      }
      @if (serverError()) {
        <p class="error" role="alert">{{ serverError() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions>
      @if (tx.splits.length) {
        <button mat-button class="clear" (click)="clear()" [disabled]="saving()">Remove all splits</button>
      }
      <span class="spacer"></span>
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        (click)="save()"
        [disabled]="saving() || !validation().valid || rows().length === 0"
        data-testid="save-splits"
      >
        Save splits
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .tx {
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .cat {
      flex: 1 1 180px;
    }
    .amt {
      width: 140px;
    }
    .row-error {
      flex-basis: 100%;
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-small);
    }
    .remaining {
      margin-top: 12px;
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-error);
    }
    .remaining.ok {
      color: inherit;
    }
    .error {
      color: var(--mat-sys-error);
      margin: 4px 0;
    }
    .spacer {
      flex: 1;
    }
    .clear {
      color: var(--mat-sys-error);
    }
  `,
})
export class SplitDialog {
  protected readonly data = inject<SplitDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<SplitDialog, Transaction>>(MatDialogRef);
  private readonly api = inject(TransactionsApi);

  protected readonly tx = this.data.transaction;
  protected readonly rows = signal<SplitDraft[]>(
    this.tx.splits.length
      ? this.tx.splits.map((s) => ({ categoryId: s.categoryId, amount: s.amount }))
      : [
          { categoryId: this.tx.categoryId, amount: this.tx.amount },
          { categoryId: null, amount: null },
        ],
  );
  protected readonly touched = signal<ReadonlySet<number>>(new Set());
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly validation = computed(() => validateSplits(this.tx.amount, this.rows()));

  patch(i: number, change: Partial<SplitDraft>): void {
    this.rows.update((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...change } : r)));
    this.touched.update((s) => new Set(s).add(i));
  }

  addRow(): void {
    this.rows.update((rows) => [...rows, { categoryId: null, amount: null }]);
  }

  removeRow(i: number): void {
    this.rows.update((rows) => rows.filter((_, idx) => idx !== i));
    this.touched.set(new Set());
  }

  /** Set row i's amount so the total matches exactly. */
  fillRemaining(i: number): void {
    const others = this.rows().reduce((sum, r, idx) => (idx === i ? sum : sum + (toCents(r.amount) ?? 0)), 0);
    const cents = (toCents(this.tx.amount) ?? 0) - others;
    this.patch(i, { amount: fromCents(cents) });
  }

  save(): void {
    this.submitted.set(true);
    const v = this.validation();
    if (!v.valid || !this.rows().length) return;
    this.send(v.splits);
  }

  clear(): void {
    this.send([]);
  }

  private send(splits: { categoryId: number; amount: number }[]): void {
    this.saving.set(true);
    this.serverError.set(null);
    this.api.setSplits(this.tx.id, splits).subscribe({
      next: (updated) => this.ref.close(updated),
      error: (err: unknown) => {
        this.saving.set(false);
        this.serverError.set(errorMessage(err));
      },
    });
  }
}
