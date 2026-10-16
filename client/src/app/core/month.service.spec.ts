import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { StatementsApi } from './api/statements.api';
import { MonthSummary } from './models';
import { MonthService } from './month.service';
import { currentMonth, formatMonth, isValidMonth } from './month-utils';

@Component({ template: '' })
class Blank {}

function summary(month: string): MonthSummary {
  return { month, fileCount: 1, transactionCount: 1, uncategorizedCount: 0, lastProcessedAt: null };
}

describe('MonthService', () => {
  let months$: Subject<MonthSummary[]>;
  let api: jasmine.SpyObj<StatementsApi>;

  function setup() {
    months$ = new Subject<MonthSummary[]>();
    api = jasmine.createSpyObj<StatementsApi>('StatementsApi', ['months']);
    api.months.and.returnValue(months$);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Blank },
          { path: 'transactions', component: Blank },
        ]),
        { provide: StatementsApi, useValue: api },
      ],
    });
    return { router: TestBed.inject(Router), svc: TestBed.inject(MonthService) };
  }

  it('takes the month from ?month= in the URL', async () => {
    const { router, svc } = setup();
    await router.navigateByUrl('/transactions?month=2024-02');
    expect(svc.selected()).toBe('2024-02');
  });

  it('defaults to the most recent month from /api/months and writes it to the URL', async () => {
    const { router, svc } = setup();
    await router.navigateByUrl('/');
    expect(svc.selected()).toBeNull(); // waiting for months
    months$.next([summary('2024-03'), summary('2024-01')]);
    await TestBed.inject(Router).navigated;
    await new Promise((r) => setTimeout(r));
    expect(svc.selected()).toBe('2024-03');
    expect(router.url).toBe('/?month=2024-03');
  });

  it('defaults to the current month when there are no months', async () => {
    const { router, svc } = setup();
    await router.navigateByUrl('/transactions');
    months$.next([]);
    await new Promise((r) => setTimeout(r));
    expect(svc.selected()).toBe(currentMonth());
    expect(router.url).toBe(`/transactions?month=${currentMonth()}`);
  });

  it('defaults to the current month when /api/months fails', async () => {
    api = jasmine.createSpyObj<StatementsApi>('StatementsApi', ['months']);
    api.months.and.returnValue(throwError(() => new Error('down')));
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '', component: Blank }]), { provide: StatementsApi, useValue: api }],
    });
    const router = TestBed.inject(Router);
    const svc = TestBed.inject(MonthService);
    await router.navigateByUrl('/');
    await new Promise((r) => setTimeout(r));
    expect(svc.selected()).toBe(currentMonth());
  });

  it('ignores an invalid ?month= and applies the default', async () => {
    const { router, svc } = setup();
    months$.next([summary('2024-01')]);
    await router.navigateByUrl('/?month=2024-13');
    await new Promise((r) => setTimeout(r));
    expect(svc.selected()).toBe('2024-01');
    expect(router.url).toBe('/?month=2024-01');
  });

  it('select() updates the signal and the URL, preserving other params and the path', async () => {
    const { router, svc } = setup();
    await router.navigateByUrl('/transactions?month=2024-01&uncategorized=true');
    svc.select('2023-12');
    expect(svc.selected()).toBe('2023-12');
    await new Promise((r) => setTimeout(r));
    const tree = router.parseUrl(router.url);
    expect(tree.root.children['primary'].segments.map((s) => s.path)).toEqual(['transactions']);
    expect(tree.queryParams).toEqual({ month: '2023-12', uncategorized: 'true' });
  });

  it('select() ignores invalid months', async () => {
    const { router, svc } = setup();
    await router.navigateByUrl('/?month=2024-01');
    svc.select('nope');
    expect(svc.selected()).toBe('2024-01');
  });

  it('back/forward navigation to a different ?month= updates the signal', async () => {
    const { router, svc } = setup();
    await router.navigateByUrl('/?month=2024-01');
    await router.navigateByUrl('/transactions?month=2024-02');
    expect(svc.selected()).toBe('2024-02');
  });

  it('keeps the selection when navigating to a link without ?month=', async () => {
    const { router, svc } = setup();
    await router.navigateByUrl('/?month=2024-02');
    await router.navigateByUrl('/transactions');
    await new Promise((r) => setTimeout(r));
    expect(svc.selected()).toBe('2024-02');
    expect(router.url).toBe('/transactions?month=2024-02');
  });

  it('options include a free-picked month not in the list', async () => {
    const { router, svc } = setup();
    months$.next([summary('2024-03'), summary('2024-01')]);
    await router.navigateByUrl('/?month=2024-02');
    expect(svc.options()).toEqual(['2024-03', '2024-02', '2024-01']);
  });

  it('refreshMonths() re-fetches', () => {
    const { svc } = setup();
    api.months.and.returnValue(of([summary('2025-01')]));
    svc.refreshMonths();
    expect(svc.months().map((m) => m.month)).toEqual(['2025-01']);
    expect(api.months).toHaveBeenCalledTimes(2);
  });
});

describe('month utils', () => {
  it('validates YYYY-MM', () => {
    expect(isValidMonth('2024-01')).toBeTrue();
    expect(isValidMonth('2024-12')).toBeTrue();
    expect(isValidMonth('2024-13')).toBeFalse();
    expect(isValidMonth('2024-1')).toBeFalse();
    expect(isValidMonth(null)).toBeFalse();
  });

  it('formats', () => {
    expect(currentMonth(new Date(2024, 0, 15))).toBe('2024-01');
    expect(formatMonth('2024-03')).toBe('Mar 2024');
  });
});
