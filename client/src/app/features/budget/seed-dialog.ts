import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { BudgetPlanApi } from '../../core/api/budget-plan.api';
import { errorMessage } from '../../core/http-context';
import { MainBudget, MainBudgetItem, Month, RoundTo, SeedSource } from '../../core/models';
import { isValidMonth } from '../../core/month-utils';
import { SeedDiff, SeedForm, buildSeedRequest, previousMonth, seedDiff } from './budget-logic';

export interface SeedDialogData {
  selectedMonth: Month;
  /** Main budget as of the selected month (to show current vs proposed). */
  currentMain: MainBudgetItem[];
}

/** "Create from a month…": preview, then seed. Closes with the new MainBudget, or undefined. */
@Component({
  selector: 'app-seed-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CurrencyPipe,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
  ],
  template: `
    <h2 mat-dialog-title>Create main budget from a month</h2>
    <mat-dialog-content>
      <div class="form">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>From month</mat-label>
          <input matInput [ngModel]="fromMonth()" (ngModelChange)="set(fromMonth, $event)" maxlength="7" data-testid="seed-from" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Use</mat-label>
          <mat-select [ngModel]="source()" (ngModelChange)="set(source, $event)">
            <mat-option value="actual">What I actually spent</mat-option>
            <mat-option value="budget">That month's budget</mat-option>
            <mat-option value="average">Average spending</mat-option>
          </mat-select>
        </mat-form-field>
        @if (source() === 'average') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="narrow">
            <mat-label>Months</mat-label>
            <input matInput type="number" min="1" max="24" [ngModel]="averageMonths()" (ngModelChange)="set(averageMonths, +$event)" />
          </mat-form-field>
        }
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="narrow">
          <mat-label>Round up to</mat-label>
          <mat-select [ngModel]="roundTo()" (ngModelChange)="set(roundTo, $event)">
            @for (r of roundOptions; track r) {
              <mat-option [value]="r">\${{ r }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Start month</mat-label>
          <input matInput [ngModel]="effectiveFrom()" (ngModelChange)="set(effectiveFrom, $event)" maxlength="7" data-testid="seed-start" />
        </mat-form-field>
        <button mat-stroked-button (click)="loadPreview()" [disabled]="!formValid() || loading()" data-testid="seed-preview-btn">
          Preview
        </button>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (diff(); as d) {
        @if (d.rows.length === 0) {
          <p class="empty-state">No spending found for that choice — nothing to propose.</p>
        } @else {
          <table class="preview" data-testid="seed-preview">
            <thead>
              <tr><th>Category</th><th class="num">Current</th><th class="num">Proposed</th><th></th></tr>
            </thead>
            <tbody>
              @for (r of d.rows; track r.categoryId) {
                <tr [class]="r.change">
                  <td>{{ r.categoryName }}</td>
                  <td class="num tabular">{{ r.current === null ? '—' : (r.current | currency) }}</td>
                  <td class="num tabular">{{ r.proposed === null ? '—' : (r.proposed | currency) }}</td>
                  <td class="change">{{ changeLabel[r.change] }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th class="num tabular">{{ d.currentTotal | currency }}</th>
                <th class="num tabular">{{ d.proposedTotal | currency }}</th>
                <th></th>
              </tr>
            </tfoot>
          </table>
          <p class="hint">
            Starting {{ previewedStart() }}, the main budget will be exactly the proposed column. Earlier months are unchanged.
          </p>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        (click)="confirm()"
        [disabled]="!diff() || diff()!.rows.length === 0 || saving() || stale()"
        data-testid="seed-confirm"
      >
        Replace main budget
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 12px;
      mat-form-field {
        width: 170px;
      }
      .narrow {
        width: 110px;
      }
    }
    .preview {
      width: 100%;
      border-collapse: collapse;
      th,
      td {
        text-align: left;
        padding: 4px 8px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .num {
        text-align: right;
      }
      .change {
        font: var(--mat-sys-label-small);
        color: var(--mat-sys-on-surface-variant);
      }
      tr.removed td {
        color: var(--mat-sys-error);
      }
      tr.new td:first-child {
        font-weight: 500;
      }
    }
    .hint {
      color: var(--mat-sys-on-surface-variant);
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
})
export class SeedDialog {
  protected readonly data = inject<SeedDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<SeedDialog, MainBudget>>(MatDialogRef);
  private readonly api = inject(BudgetPlanApi);

  protected readonly roundOptions: RoundTo[] = [1, 5, 10, 25, 50];
  protected readonly changeLabel = { new: 'new', removed: 'removed', changed: 'changed', same: '' };

  protected readonly fromMonth = signal(previousMonth(this.data.selectedMonth));
  protected readonly source = signal<SeedSource>('actual');
  protected readonly averageMonths = signal(3);
  protected readonly roundTo = signal<RoundTo>(25);
  protected readonly effectiveFrom = signal(this.data.selectedMonth);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly diff = signal<SeedDiff | null>(null);
  /** The form the current preview was made with; confirm is disabled once the form changes. */
  private readonly previewedForm = signal<SeedForm | null>(null);

  protected readonly form = computed<SeedForm>(() => ({
    fromMonth: this.fromMonth().trim(),
    source: this.source(),
    averageMonths: this.averageMonths(),
    roundTo: this.roundTo(),
    effectiveFrom: this.effectiveFrom().trim(),
  }));
  protected readonly formValid = computed(
    () => isValidMonth(this.form().fromMonth) && isValidMonth(this.form().effectiveFrom),
  );
  protected readonly stale = computed(
    () => JSON.stringify(this.previewedForm()) !== JSON.stringify(this.form()),
  );
  protected readonly previewedStart = computed(() => this.previewedForm()?.effectiveFrom ?? '');

  set<T>(sig: { set(v: T): void }, value: T): void {
    sig.set(value);
  }

  loadPreview(): void {
    if (!this.formValid()) return;
    const form = this.form();
    this.loading.set(true);
    this.error.set(null);
    this.api.seedPreview(buildSeedRequest(form)).subscribe({
      next: (p) => {
        this.loading.set(false);
        this.diff.set(seedDiff(p, this.data.currentMain));
        this.previewedForm.set(form);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  confirm(): void {
    const form = this.previewedForm();
    if (!form || this.stale()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.seed(buildSeedRequest(form)).subscribe({
      next: (main) => this.ref.close(main),
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
