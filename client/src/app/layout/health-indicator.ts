import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, map, of, switchMap, timer } from 'rxjs';
import { HealthApi } from '../core/api/health.api';
import { Health } from '../core/models';

export const HEALTH_POLL_MS = 30_000;

export type HealthLevel = 'ok' | 'degraded' | 'down' | 'unknown';

/** ok = db + ollama + model available; degraded = db ok but AI unavailable; down = API/db unreachable. */
export function healthLevel(h: Health | null | undefined): HealthLevel {
  if (h === undefined) return 'unknown';
  if (h === null || h.db !== 'ok') return 'down';
  if (h.ollama !== 'ok' || !h.modelAvailable) return 'degraded';
  return 'ok';
}

@Component({
  selector: 'app-health-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTooltipModule],
  template: `
    <span
      class="dot"
      [class]="'dot ' + level()"
      [matTooltip]="tooltip()"
      matTooltipClass="health-tooltip"
      role="status"
      [attr.aria-label]="'System health: ' + tooltip()"
    ></span>
    <span class="label">{{ shortLabel() }}</span>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 8px;
      font: var(--mat-sys-label-medium);
    }
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--app-muted);
      box-shadow: 0 0 0 2px var(--mat-sys-surface-container);
    }
    .dot.ok {
      background: var(--app-good);
    }
    .dot.degraded {
      background: var(--app-warning);
    }
    .dot.down {
      background: var(--app-critical);
    }
    @media (max-width: 599px) {
      .label {
        display: none;
      }
    }
  `,
})
export class HealthIndicator {
  private readonly api = inject(HealthApi);

  /** undefined = first check pending; null = request failed. */
  protected readonly health = toSignal<Health | null | undefined>(
    timer(0, HEALTH_POLL_MS).pipe(
      switchMap(() => this.api.get().pipe(catchError(() => of(null)))),
      map((h) => h),
    ),
    { initialValue: undefined },
  );

  protected readonly level = computed(() => healthLevel(this.health()));

  protected readonly shortLabel = computed(() => {
    switch (this.level()) {
      case 'ok':
        return 'AI ready';
      case 'degraded':
        return 'AI offline';
      case 'down':
        return 'Offline';
      default:
        return 'Checking…';
    }
  });

  protected readonly tooltip = computed(() => {
    const h = this.health();
    if (h === undefined) return 'Checking health…';
    if (h === null) return 'API unreachable';
    const model = h.modelAvailable ? `${h.model} available` : `${h.model} not pulled`;
    return `Database: ${h.db} · Ollama: ${h.ollama} · Model: ${model}`;
  });
}
