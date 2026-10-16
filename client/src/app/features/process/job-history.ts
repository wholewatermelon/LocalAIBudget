import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Job } from '../../core/models';

@Component({
  selector: 'app-job-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatIconModule, MatButtonModule],
  template: `
    @if (jobs().length === 0) {
      <p class="empty-state">No jobs have run for this month.</p>
    } @else {
      <div class="table-wrap">
        <table class="history">
          <thead>
            <tr>
              <th>Started</th>
              <th>Mode</th>
              <th>Status</th>
              <th class="num">Inserted</th>
              <th class="num">Dupes</th>
              <th class="num">Categorized</th>
              <th class="num">Rules</th>
              <th class="num">Transfers</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            @for (j of jobs(); track j.id) {
              <tr data-testid="job-row">
                <td>{{ j.startedAt ?? j.createdAt | date: 'short' }}</td>
                <td>{{ j.mode }}</td>
                <td>
                  <span class="badge" [class.failed]="j.status === 'failed'">{{ j.status }}</span>
                </td>
                <td class="num">{{ j.inserted }}</td>
                <td class="num">{{ j.skippedDuplicates }}</td>
                <td class="num">{{ j.categorized }}</td>
                <td class="num">{{ j.rulesApplied ?? '—' }}</td>
                <td class="num">{{ j.transfersMatched ?? '—' }}</td>
                <td>
                  @if (j.errors.length || (j.status === 'failed' && j.message)) {
                    <button mat-button (click)="toggle(j.id)" [attr.aria-expanded]="expanded() === j.id">
                      {{ j.errors.length }} <mat-icon iconPositionEnd>{{ expanded() === j.id ? 'expand_less' : 'expand_more' }}</mat-icon>
                    </button>
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
              </tr>
              @if (expanded() === j.id) {
                <tr class="detail" data-testid="job-errors">
                  <td colspan="9">
                    @if (j.message) {
                      <p class="msg">{{ j.message }}</p>
                    }
                    <ul>
                      @for (e of j.errors; track $index) {
                        <li>
                          @if (e.file) {
                            <code>{{ e.file }}@if (e.line != null) {:{{ e.line }}}</code>
                          }
                          {{ e.message }}
                        </li>
                      }
                    </ul>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .table-wrap {
      overflow-x: auto;
    }
    .history {
      width: 100%;
      border-collapse: collapse;
      th,
      td {
        text-align: left;
        padding: 6px 8px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        white-space: nowrap;
      }
      th {
        font: var(--mat-sys-label-medium);
        color: var(--mat-sys-on-surface-variant);
      }
      .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
    }
    .badge.failed {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .detail td {
      white-space: normal;
      background: var(--mat-sys-surface-container-low);
    }
    .msg {
      color: var(--mat-sys-error);
    }
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class JobHistory {
  readonly jobs = input.required<Job[]>();
  protected readonly expanded = signal<number | null>(null);

  toggle(id: number): void {
    this.expanded.update((cur) => (cur === id ? null : id));
  }
}
