import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Month } from '../../core/models';
import { formatMonth, isValidMonth } from '../../core/month-utils';

export interface ApplyStartingData {
  /** What is being changed, e.g. "Food → $450.00" or "Remove Gym". */
  summary: string;
  defaultMonth: Month;
}

/** "Apply starting:" month prompt for main-budget edits. Closes with the chosen month, or undefined. */
@Component({
  selector: 'app-apply-starting-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Change the main budget</h2>
    <mat-dialog-content>
      <p><strong>{{ data.summary }}</strong></p>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Apply starting (YYYY-MM)</mat-label>
        <input
          matInput
          [ngModel]="month()"
          (ngModelChange)="month.set($event)"
          maxlength="7"
          data-testid="apply-starting-month"
        />
      </mat-form-field>
      <p class="hint">
        @if (valid()) {
          Applies to {{ label() }} and later months. Earlier months keep the budget they had.
        } @else {
          Enter a month like 2024-03.
        }
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [disabled]="!valid()" (click)="confirm()" data-testid="apply-starting-confirm">Apply</button>
    </mat-dialog-actions>
  `,
  styles: `
    .hint {
      color: var(--mat-sys-on-surface-variant);
      max-width: 420px;
    }
  `,
})
export class ApplyStartingDialog {
  protected readonly data = inject<ApplyStartingData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ApplyStartingDialog, Month>>(MatDialogRef);
  protected readonly month = signal(this.data.defaultMonth);
  protected readonly valid = computed(() => isValidMonth(this.month().trim()));
  protected readonly label = computed(() => formatMonth(this.month().trim()));

  confirm(): void {
    if (this.valid()) this.ref.close(this.month().trim());
  }
}
