import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  makeCategory,
  makeInsight,
  makeJob,
  makeMonth,
  makeMonthBudget,
  makeMonthItem,
  makeSummary,
} from '../../../testing/fixtures';
import { SKIP_ERROR_SNACKBAR } from '../../core/http-context';
import { INSIGHT_TIMEOUT_MS } from '../../core/api/insights.api';
import { monthServiceStub } from '../../../testing/month-service.stub';
import { MonthSummary } from '../../core/models';
import { DashboardPage } from './dashboard.page';

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let monthStub: ReturnType<typeof monthServiceStub>['stub'];

  function setup(uncategorized = 0, extra: Partial<MonthSummary> = {}) {
    const month = monthServiceStub('2024-01', [makeMonth('2024-01', { uncategorizedCount: uncategorized, ...extra })]);
    monthStub = month.stub;
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), month],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPage);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  function flushMonthView(items = [makeMonthItem({ categoryId: 1 })]) {
    const req = http.expectOne((r) => r.url === '/api/budget/month' && r.params.get('month') === '2024-01');
    expect(req.request.context.get(SKIP_ERROR_SNACKBAR)).toBeTrue();
    req.flush(makeMonthBudget(items));
  }

  function flushInitial(summary = makeSummary(), monthItems = [makeMonthItem({ categoryId: 1 })]) {
    http.expectOne('/api/categories').flush([makeCategory({ id: 1, name: 'Food' }), makeCategory({ id: 6, name: 'Income', isIncome: true })]);
    http.expectOne((r) => r.url === '/api/budget/summary' && r.params.get('month') === '2024-01').flush(summary);
    const trend = http.expectOne((r) => r.url === '/api/budget/trend');
    expect(trend.request.params.get('month')).toBe('2024-01'); // anchored at the selected month
    trend.flush([
      { month: '2023-12', totalIncome: 3000, totalSpent: 900, byCategory: { Food: 300, Housing: 600, Income: 3000 } },
      { month: '2024-01', totalIncome: 3000, totalSpent: 1200, byCategory: { Food: 350, Housing: 850, Transfer: 500 } },
    ]);
    flushMonthView(monthItems);
    fixture.detectChanges(); // renders the insights panel, which then fetches the latest insight
    http.expectOne((r) => r.url === '/api/insights').flush(makeInsight());
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('renders totals, budget bars (excluding income/transfer) and insights', () => {
    setup();
    flushInitial();
    expect(monthStub.refreshMonths).toHaveBeenCalled(); // counts refreshed on load
    const nonSpending = Array.from(el.querySelectorAll('[data-testid="non-spending-row"]')).map((r) => r.textContent);
    expect(nonSpending[0]).toContain('moved'); // Transfer
    expect(nonSpending[1]).toContain('received'); // Income
    expect(el.querySelector('[data-testid="total-income"]')?.textContent).toContain('$3,000.00');
    expect(el.querySelector('[data-testid="total-spent"]')?.textContent).toContain('$1,200.00');
    expect(el.querySelector('[data-testid="total-net"]')?.textContent).toContain('$1,800.00');

    const rows = Array.from(el.querySelectorAll('[data-testid="budget-row"]'));
    expect(rows.map((r) => r.querySelector('.name')?.textContent?.trim())).toEqual(['Food', 'Housing']);
    expect(rows.map((r) => r.getAttribute('data-status'))).toEqual(['warn', 'warn']);
    expect(el.textContent).toContain('Money in & transfers');
    expect(el.querySelectorAll('[data-testid="suggestion"]').length).toBe(1);
    expect(el.querySelector('[data-testid="uncategorized-warning"]')).toBeNull();
    // Trend chart excluded Income + Transfer from the stacks
    expect(el.querySelectorAll('app-trend-chart rect.seg').length).toBe(4);
  });

  it('uses the isTransfer flag (not the name) to keep categories out of budget bars and the trend', () => {
    setup();
    http.expectOne('/api/categories').flush([
      makeCategory({ id: 1, name: 'Food' }),
      makeCategory({ id: 7, name: 'Card Payments', isTransfer: true }),
      makeCategory({ id: 8, name: 'Transfer', isTransfer: false }),
    ]);
    http.expectOne((r) => r.url === '/api/budget/summary').flush(
      makeSummary({
        categories: [
          { categoryId: 1, name: 'Food', budgetLimit: 400, spent: 100, remaining: 300, percentUsed: 25, isIncome: false, isTransfer: false },
          { categoryId: 7, name: 'Card Payments', budgetLimit: null, spent: 900, remaining: null, percentUsed: null, isIncome: false, isTransfer: true },
          { categoryId: 8, name: 'Transfer', budgetLimit: 50, spent: 10, remaining: 40, percentUsed: 20, isIncome: false, isTransfer: false },
        ],
      }),
    );
    http.expectOne((r) => r.url === '/api/budget/trend').flush([
      { month: '2024-01', totalIncome: 0, totalSpent: 110, byCategory: { Food: 100, 'Card Payments': 900, Transfer: 10 } },
    ]);
    flushMonthView([]);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/insights').flush(null);
    fixture.detectChanges();
    const names = Array.from(el.querySelectorAll('[data-testid="budget-row"] .name')).map((n) => n.textContent?.trim());
    expect(names).toEqual(['Food', 'Transfer']); // sorted by % used
    expect(el.textContent).toContain('Card Payments');
    expect(el.querySelectorAll('app-trend-chart rect.seg').length).toBe(2); // Food + "Transfer" (flag false)
  });

  it('shows the uncategorized warning linking to transactions', () => {
    setup(3);
    flushInitial(makeSummary({ uncategorizedSpent: 42 }));
    const link = el.querySelector<HTMLAnchorElement>('[data-testid="uncategorized-warning"]');
    expect(link).not.toBeNull();
    expect(link!.textContent).toContain('3 uncategorized transactions');
    expect(link!.getAttribute('href')).toContain('/transactions?month=2024-01&uncategorized=true');
  });

  it('warns about reconciliation issues and links needs-review count', () => {
    setup(0, { reconciliationIssues: 2, needsReviewCount: 5 });
    flushInitial();
    const recon = el.querySelector<HTMLAnchorElement>('[data-testid="reconciliation-warning"]')!;
    expect(recon.textContent).toContain("2 statement files don't reconcile");
    expect(recon.getAttribute('href')).toContain('/process?month=2024-01');
    const review = el.querySelector<HTMLAnchorElement>('[data-testid="needs-review-link"]')!;
    expect(review.textContent).toContain('5 transactions need review');
    expect(review.getAttribute('href')).toContain('needsReview=true');
  });

  it('hides reconciliation and review notices when there is nothing to show', () => {
    setup();
    flushInitial();
    expect(el.querySelector('[data-testid="reconciliation-warning"]')).toBeNull();
    expect(el.querySelector('[data-testid="needs-review-link"]')).toBeNull();
  });

  function openApplyMenu(): void {
    el.querySelector<HTMLButtonElement>('[data-testid="apply"]')!.click();
    fixture.detectChanges();
  }

  function flushReload() {
    http.expectOne((r) => r.url === '/api/budget/summary').flush(makeSummary());
    http.expectOne((r) => r.url === '/api/budget/trend').flush([]);
    flushMonthView();
    fixture.detectChanges();
  }

  it('shows current effective budget -> suggested in the suggestion', () => {
    setup();
    flushInitial();
    expect(el.querySelector('[data-testid="suggestion"]')?.textContent).toContain('$400.00 →');
  });

  it('Apply → "Just this month" PUTs the month item and refreshes the dashboard', () => {
    setup();
    flushInitial();
    openApplyMenu();
    document.querySelector<HTMLButtonElement>('[data-testid="apply-month"]')!.click();
    const put = http.expectOne({ method: 'PUT', url: '/api/budget/month/2024-01/items/1' });
    expect(put.request.body).toEqual({ amount: 350 });
    put.flush(makeMonthBudget([]));
    flushReload();
    expect(el.querySelector('[data-testid="suggestion"]')?.textContent).toContain('This month');
  });

  it('Apply → "Main budget from this month on" PUTs a main version effective this month', () => {
    setup();
    flushInitial();
    openApplyMenu();
    document.querySelector<HTMLButtonElement>('[data-testid="apply-main"]')!.click();
    const put = http.expectOne({ method: 'PUT', url: '/api/budget/main/items/1' });
    expect(put.request.body).toEqual({ amount: 350, effectiveFrom: '2024-01' });
    put.flush({ month: '2024-01', items: [], total: 0 });
    flushReload();
    expect(el.querySelector('[data-testid="suggestion"]')?.textContent).toContain('Main budget');
  });

  it('shows "adjusted" / "this month only" markers on budget bars from the month view', () => {
    setup();
    flushInitial(makeSummary(), [
      makeMonthItem({ categoryId: 1, source: 'adjusted', adjustedAmount: 400 }),
      makeMonthItem({ categoryId: 2, categoryName: 'Housing', source: 'main' }),
    ]);
    const rows = Array.from(el.querySelectorAll('[data-testid="budget-row"]'));
    expect(rows[0].querySelector('[data-testid="adjusted-marker"]')?.textContent).toContain('adjusted');
    expect(rows[1].querySelector('[data-testid="adjusted-marker"]')).toBeNull();
  });

  it('still renders when the month view endpoint fails (no markers, no snackbar)', () => {
    setup();
    http.expectOne('/api/categories').flush([makeCategory({ id: 1 })]);
    http.expectOne((r) => r.url === '/api/budget/summary').flush(makeSummary());
    http.expectOne((r) => r.url === '/api/budget/trend').flush([]);
    http.expectOne((r) => r.url === '/api/budget/month').flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/insights').flush(null);
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-testid="budget-row"]').length).toBe(2);
    expect(el.querySelector('[data-testid="adjusted-marker"]')).toBeNull();
  });

  it('generate shows a spinner while waiting, then the new insight', () => {
    setup();
    flushInitial();
    const btn = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('insights'))!;
    btn.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="insights-generating"]')).not.toBeNull();
    http.expectOne((r) => r.url === '/api/jobs' && !r.params.has('month')).flush([]);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="insights-generating"]')?.textContent).toContain('minute or two');
    http.expectOne('/api/insights/generate').flush(makeInsight({ summary: 'Fresh take' }));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="insights-generating"]')).toBeNull();
    expect(el.textContent).toContain('Fresh take');
  });

  it('warns that generation is slower while a processing job runs', () => {
    setup();
    flushInitial();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('insights'))!.click();
    http.expectOne((r) => r.url === '/api/jobs').flush([makeJob({ status: 'running', month: '2023-12' })]);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="insights-generating"]')?.textContent).toContain('few minutes');
    http.expectOne('/api/insights/generate').flush(makeInsight());
  });

  it('on client timeout, re-GETs once and shows a result the server saved meanwhile', fakeAsync(() => {
    setup();
    flushInitial();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('insights'))!.click();
    http.expectOne((r) => r.url === '/api/jobs').flush([]);
    http.expectOne('/api/insights/generate');
    tick(INSIGHT_TIMEOUT_MS);
    http.expectOne((r) => r.url === '/api/insights').flush(makeInsight({ id: 2, summary: 'Saved late' }));
    fixture.detectChanges();
    expect(el.textContent).toContain('Saved late');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  }));

  it('on client timeout with nothing new saved, shows the timeout error', fakeAsync(() => {
    setup();
    flushInitial();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('insights'))!.click();
    http.expectOne((r) => r.url === '/api/jobs').flush([]);
    http.expectOne('/api/insights/generate');
    tick(INSIGHT_TIMEOUT_MS);
    http.expectOne((r) => r.url === '/api/insights').flush(makeInsight()); // same id as before
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('timed out');
  }));

  it('shows an inline error when generation fails', () => {
    setup();
    flushInitial();
    const btn = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('insights'))!;
    btn.click();
    http.expectOne((r) => r.url === '/api/jobs').flush([]);
    http.expectOne('/api/insights/generate').flush({ message: 'Ollama unreachable' }, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Ollama unreachable');
  });
});
