import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MonthService } from '../core/month.service';
import { formatMonth, isValidMonth } from '../core/month-utils';

@Component({
  selector: 'app-month-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="select">
      <mat-label>Month</mat-label>
      <mat-select
        [value]="svc.selected()"
        (selectionChange)="svc.select($event.value)"
        aria-label="Selected month"
      >
        @for (m of svc.options(); track m) {
          <mat-option [value]="m">{{ label(m) }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
    <button
      mat-icon-button
      [matMenuTriggerFor]="menu"
      #trigger="matMenuTrigger"
      matTooltip="Pick another month"
      aria-label="Pick another month"
    >
      <mat-icon>edit_calendar</mat-icon>
    </button>
    <mat-menu #menu="matMenu">
      <form class="custom" (click)="$event.stopPropagation()" (ngSubmit)="apply(trigger)">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>YYYY-MM</mat-label>
          <input
            matInput
            name="custom"
            [ngModel]="custom()"
            (ngModelChange)="custom.set($event)"
            placeholder="2024-01"
            pattern="\\d{4}-(0[1-9]|1[0-2])"
            maxlength="7"
          />
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="!valid()">Go</button>
      </form>
    </mat-menu>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .select {
      width: 150px;
      --mat-form-field-container-height: 40px;
      --mat-form-field-container-vertical-padding: 8px;
      font-size: 14px;
    }
    @media (max-width: 599px) {
      .select {
        width: 120px;
      }
    }
    .custom {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px 12px;
    }
  `,
})
export class MonthPicker {
  protected readonly svc = inject(MonthService);
  protected readonly custom = signal('');
  protected readonly label = formatMonth;

  protected valid(): boolean {
    return isValidMonth(this.custom().trim());
  }

  protected apply(trigger: MatMenuTrigger): void {
    const value = this.custom().trim();
    if (!isValidMonth(value)) return;
    this.svc.select(value);
    this.custom.set('');
    trigger.closeMenu();
  }
}
