import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { jobProgress } from '../../core/job-polling';
import { Job } from '../../core/models';

@Component({
  selector: 'app-job-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressBarModule, MatIconModule],
  template: `
    @let j = job();
    <div class="head">
      <strong>
        {{ j.mode === 'recategorize' ? 'Re-categorizing' : 'Processing' }} {{ j.month }}
      </strong>
      <span class="status" [class]="'status ' + j.status" data-testid="job-status">
        @switch (j.status) {
          @case ('completed') { <mat-icon>check_circle</mat-icon> Completed }
          @case ('failed') { <mat-icon>error</mat-icon> Failed }
          @case ('queued') { Queued… }
          @default { Running… }
        }
      </span>
    </div>
    @if (j.status === 'queued' || j.status === 'running') {
      <mat-progress-bar
        [mode]="pct() === null ? 'indeterminate' : 'determinate'"
        [value]="pct() ?? 0"
      />
      @if (j.total) {
        <div class="muted">{{ j.processed }} / {{ j.total }}</div>
      }
    }
    @if (j.message) {
      <p class="message" [class.error]="j.status === 'failed'">{{ j.message }}</p>
    }
    <div class="counts" data-testid="job-counts">
      <span><strong>{{ j.inserted }}</strong> inserted</span>
      <span><strong>{{ j.skippedDuplicates }}</strong> duplicates skipped</span>
      <span><strong>{{ j.categorized }}</strong> categorized</span>
      @if (j.rulesApplied != null) {
        <span><strong>{{ j.rulesApplied }}</strong> by rules</span>
      }
      @if (j.transfersMatched != null) {
        <span><strong>{{ j.transfersMatched }}</strong> transfers matched</span>
      }
      @if (j.errors.length) {
        <span class="error"><strong>{{ j.errors.length }}</strong> errors</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      padding: 16px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container);
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }
    .status.completed mat-icon {
      color: var(--app-good);
    }
    .status.failed {
      color: var(--mat-sys-error);
    }
    .counts {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 8px;
    }
    .muted {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
      margin-top: 4px;
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
})
export class JobProgress {
  readonly job = input.required<Job>();
  protected readonly pct = computed(() => jobProgress(this.job()));
}
