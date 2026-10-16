import { computed, signal } from '@angular/core';
import { MonthService } from '../app/core/month.service';
import { MonthSummary } from '../app/core/models';

/** Minimal MonthService stand-in for component tests. */
export function monthServiceStub(month: string | null = '2024-01', months: MonthSummary[] = []) {
  const selected = signal<string | null>(month);
  const list = signal<MonthSummary[]>(months);
  const stub = {
    selected,
    months: list,
    monthsLoaded: signal(true),
    options: computed(() => list().map((m) => m.month)),
    selectedSummary: computed(() => list().find((m) => m.month === selected()) ?? null),
    select: jasmine.createSpy('select').and.callFake((m: string) => selected.set(m)),
    refreshMonths: jasmine.createSpy('refreshMonths'),
  };
  return { provide: MonthService, useValue: stub, stub };
}
