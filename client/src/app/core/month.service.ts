import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { StatementsApi } from './api/statements.api';
import { Month, MonthSummary } from './models';
import { currentMonth, isValidMonth } from './month-utils';

/**
 * Owns the globally selected month.
 *
 * - `selected()` is null until resolved, then always a valid 'YYYY-MM'.
 * - The URL `?month=` is the source of truth: navigation updates the signal, `select()` updates the URL.
 * - With no/invalid `?month=`, the default is the newest month from GET /api/months, else the current month,
 *   and it is written back to the URL (replaceUrl, so Back still works).
 */
@Injectable({ providedIn: 'root' })
export class MonthService {
  private readonly router = inject(Router);
  private readonly api = inject(StatementsApi);

  private readonly _selected = signal<Month | null>(null);
  private readonly _months = signal<MonthSummary[]>([]);
  private readonly _monthsLoaded = signal(false);
  /** True when the current URL has no valid ?month= and we are waiting for /api/months. */
  private needsDefault = false;

  readonly selected = this._selected.asReadonly();
  readonly months = this._months.asReadonly();
  readonly monthsLoaded = this._monthsLoaded.asReadonly();

  /** Known months, plus the selected one if it was free-picked (not on disk/in DB yet). */
  readonly options = computed<Month[]>(() => {
    const known = this._months().map((m) => m.month);
    const sel = this._selected();
    if (sel && !known.includes(sel)) return [sel, ...known].sort().reverse();
    return known;
  });

  readonly selectedSummary = computed(
    () => this._months().find((m) => m.month === this._selected()) ?? null,
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => this.syncFromUrl());
    this.refreshMonths();
    // If created after the initial navigation already finished, sync now.
    if (this.router.navigated) this.syncFromUrl();
  }

  /** Change the month; reflected in the URL (and from there into the signal). */
  select(month: Month): void {
    if (!isValidMonth(month)) return;
    this._selected.set(month);
    this.writeUrl(month, false);
  }

  /** Re-fetch GET /api/months (e.g. after a job completes or an upload). */
  refreshMonths(): void {
    this.api.months().subscribe({
      next: (months) => {
        this._months.set(months);
        this._monthsLoaded.set(true);
        this.applyDefaultIfNeeded();
      },
      error: () => {
        this._monthsLoaded.set(true);
        this.applyDefaultIfNeeded();
      },
    });
  }

  private syncFromUrl(): void {
    const param = this.router.parseUrl(this.router.url).queryParamMap.get('month');
    if (isValidMonth(param)) {
      this.needsDefault = false;
      if (param !== this._selected()) this._selected.set(param);
      return;
    }
    const sel = this._selected();
    if (sel) {
      // Navigated somewhere without ?month= (e.g. a plain link): keep the selection, restore the param.
      this.writeUrl(sel, true);
      return;
    }
    this.needsDefault = true;
    this.applyDefaultIfNeeded();
  }

  private applyDefaultIfNeeded(): void {
    if (!this.needsDefault || !this._monthsLoaded()) return;
    this.needsDefault = false;
    const month = this._months()[0]?.month ?? currentMonth();
    this._selected.set(month);
    this.writeUrl(month, true);
  }

  private writeUrl(month: Month, replaceUrl: boolean): void {
    const tree = this.router.parseUrl(this.router.url);
    if (tree.queryParams['month'] === month) return;
    tree.queryParams = { ...tree.queryParams, month };
    void this.router.navigateByUrl(tree, { replaceUrl });
  }
}
