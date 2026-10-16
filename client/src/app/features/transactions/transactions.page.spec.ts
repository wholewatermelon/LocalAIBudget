import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { makeCategory, makeTx } from '../../../testing/fixtures';
import { monthServiceStub } from '../../../testing/month-service.stub';
import { NotifyService } from '../../core/notify.service';
import { SEARCH_DEBOUNCE_MS, TransactionsPage } from './transactions.page';

describe('TransactionsPage', () => {
  let fixture: ComponentFixture<TransactionsPage>;
  let page: TransactionsPage;
  let http: HttpTestingController;
  let el: HTMLElement;
  let notify: jasmine.SpyObj<NotifyService>;
  let dialog: { open: jasmine.Spy };
  let month: ReturnType<typeof monthServiceStub>;

  /** Corrections refresh month counts and reload CategoryStore (transactionCount). */
  function expectCountsRefreshed(categoryReloads = 1) {
    expect(month.stub.refreshMonths).toHaveBeenCalled();
    const reqs = http.match('/api/categories');
    expect(reqs.length).toBe(categoryReloads);
    reqs.forEach((r) => r.flush([makeCategory({ id: 1, name: 'Food' }), makeCategory({ id: 2, name: 'Housing' }), makeCategory({ id: 3, name: 'Shopping' })]));
  }

  const txs = [
    makeTx({ id: 1, description: 'COFFEE', categoryId: 1, categoryName: 'Food', categorizedBy: 'ai' }),
    makeTx({ id: 2, description: 'RENT', amount: -1000, categoryId: 2, categoryName: 'Housing', categorizedBy: 'manual', isManualCorrection: true }),
    makeTx({ id: 3, description: 'COSTCO', amount: -150, splits: [{ id: 1, categoryId: 1, categoryName: 'Food', amount: -100 }, { id: 2, categoryId: 3, categoryName: 'Shopping', amount: -50 }] }),
  ];

  beforeEach(() => {
    notify = jasmine.createSpyObj<NotifyService>('NotifyService', ['info', 'error', 'action']);
    notify.action.and.returnValue(of());
    dialog = { open: jasmine.createSpy('open') };
    month = monthServiceStub('2024-01');
    TestBed.configureTestingModule({
      imports: [TransactionsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        month,
        { provide: NotifyService, useValue: notify },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TransactionsPage);
    page = fixture.componentInstance;
    el = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  function init(uncategorized?: string) {
    if (uncategorized) fixture.componentRef.setInput('uncategorized', uncategorized);
    fixture.detectChanges();
    http.expectOne('/api/accounts').flush([{ id: 1, accountName: 'Main Checking', accountType: 'Bank' }]);
    http.expectOne('/api/categories').flush([
      makeCategory({ id: 1, name: 'Food' }),
      makeCategory({ id: 2, name: 'Housing' }),
      makeCategory({ id: 3, name: 'Shopping' }),
    ]);
  }

  function flushList(list = txs) {
    const req = http.expectOne((r) => r.url === '/api/transactions');
    req.flush(list);
    fixture.detectChanges();
    return req;
  }

  it('loads the month and renders rows with ai/manual/split badges', fakeAsync(() => {
    init();
    tick(SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();
    const req = flushList();
    expect(req.request.params.get('month')).toBe('2024-01');
    const rows = el.querySelectorAll('[data-testid="tx-row"]');
    expect(rows.length).toBe(3);
    expect(el.querySelectorAll('.badge-ai').length).toBe(1);
    expect(el.querySelectorAll('.badge-manual').length).toBe(1);
    expect(el.querySelectorAll('.badge-split').length).toBe(1);
    expect(rows[2].textContent).toContain('Split across 2');
  }));

  it('applies ?uncategorized=true from the URL', fakeAsync(() => {
    init('true');
    tick(SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();
    const req = flushList([]);
    expect(req.request.params.get('uncategorized')).toBe('true');
    expect(el.textContent).toContain('No transactions match these filters');
  }));

  it('debounces search', fakeAsync(() => {
    init();
    tick(SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();
    flushList();
    page['searchText'].set('co');
    fixture.detectChanges();
    tick(100);
    page['searchText'].set('cof');
    fixture.detectChanges();
    tick(SEARCH_DEBOUNCE_MS - 1);
    fixture.detectChanges();
    http.expectNone((r) => r.url === '/api/transactions');
    tick(1);
    fixture.detectChanges();
    const req = flushList();
    expect(req.request.params.get('search')).toBe('cof');
  }));

  it('changes category optimistically and keeps server result', fakeAsync(() => {
    init();
    tick(SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();
    flushList();
    page.changeCategory(txs[0], 2);
    expect(page['rows']()[0].categoryName).toBe('Housing'); // optimistic
    expect(page['rows']()[0].categorizedBy).toBe('manual');
    const req = http.expectOne({ method: 'PATCH', url: '/api/transactions/1' });
    expect(req.request.body).toEqual({ categoryId: 2 });
    req.flush({ ...txs[0], categoryId: 2, categoryName: 'Housing', categorizedBy: 'manual', isManualCorrection: true });
    expect(page['rows']()[0].categoryId).toBe(2);
    expect(notify.error).not.toHaveBeenCalled();
    expectCountsRefreshed();
    http.expectOne((r) => r.url === '/api/rules/suggest').flush({ pattern: 'COFFEE', matchType: 'contains', matchCount: 1 });
  }));

  it('rolls back and shows a snackbar when the PATCH fails', fakeAsync(() => {
    init();
    tick(SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();
    flushList();
    page.changeCategory(txs[0], 2);
    http.expectOne('/api/transactions/1').flush({ message: 'nope' }, { status: 500, statusText: 'Error' });
    expect(page['rows']()[0]).toEqual(txs[0]);
    expect(notify.error).toHaveBeenCalled();
    expect(month.stub.refreshMonths).not.toHaveBeenCalled();
  }));

  it('after a correction, offers a rule and creates it when accepted, then reloads', fakeAsync(() => {
    notify.action.and.returnValue(of(undefined));
    init();
    tick(SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();
    flushList();
    page.changeCategory(txs[0], 3);
    http.expectOne('/api/transactions/1').flush({ ...txs[0], categoryId: 3, categoryName: 'Shopping', categorizedBy: 'manual' });
    const suggest = http.expectOne((r) => r.url === '/api/rules/suggest');
    expect(suggest.request.params.get('transactionId')).toBe('1');
    suggest.flush({ pattern: 'COFFEE', matchType: 'contains', matchCount: 12 });
    expect(notify.action).toHaveBeenCalledWith('Always categorize COFFEE as Shopping? (12 matching)', 'Create rule');
    const create = http.expectOne({ method: 'POST', url: '/api/rules' });
    expect(create.request.body).toEqual({ pattern: 'COFFEE', matchType: 'contains', categoryId: 3, applyToExisting: true });
    create.flush({ id: 1, pattern: 'COFFEE', matchType: 'contains', categoryId: 3, categoryName: 'Shopping', priority: 0, hits: 0, appliedCount: 12 });
    expect(notify.info).toHaveBeenCalledWith('Rule created — 12 transactions updated');
    expectCountsRefreshed(2); // after the PATCH and after the rule was applied
    fixture.detectChanges();
    flushList(); // reloaded with the same filters
  }));

  it('does not create a rule if the snackbar action is not clicked, and ignores suggest failures', fakeAsync(() => {
    notify.action.and.returnValue(of());
    init();
    tick(SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();
    flushList();
    page.changeCategory(txs[0], 3);
    http.expectOne('/api/transactions/1').flush({ ...txs[0], categoryId: 3 });
    http.expectOne((r) => r.url === '/api/rules/suggest').flush({ pattern: 'COFFEE', matchType: 'contains', matchCount: 2 });
    http.expectNone('/api/rules');

    page.changeCategory(txs[1], 3);
    http.expectOne('/api/transactions/2').flush({ ...txs[1], categoryId: 3 });
    http.expectOne((r) => r.url === '/api/rules/suggest').flush({}, { status: 404, statusText: 'Not Found' });
    expect(notify.error).not.toHaveBeenCalled();
    expectCountsRefreshed(2);
  }));

  it('renders rule/transfer badges, transfer pair, confidence and review controls', fakeAsync(() => {
    init();
    tick(SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();
    flushList([
      makeTx({ id: 1, categorizedBy: 'rule', categoryId: 1, categoryName: 'Food' }),
      makeTx({ id: 2, categorizedBy: 'transfer', transferPairId: 9, transferPairAccountName: 'Main Checking', amount: 500 }),
      makeTx({ id: 3, categorizedBy: 'ai', aiConfidence: 0.55, needsReview: true, categoryId: 1 }),
    ]);
    expect(el.querySelectorAll('.badge-rule').length).toBe(1);
    expect(el.querySelectorAll('.badge-transfer').length).toBe(1);
    expect(el.querySelector('[data-testid="transfer-pair"]')?.textContent).toContain('↔ Main Checking');
    const conf = el.querySelector('[data-testid="confidence"]')!;
    expect(conf.textContent).toContain('55%');
    expect(conf.classList).toContain('low');
    expect(el.querySelectorAll('[data-testid="looks-good"]').length).toBe(1);
  }));

  it('Needs review chip filters with needsReview=true; ?needsReview=true is honored', fakeAsync(() => {
    fixture.componentRef.setInput('needsReview', 'true');
    init();
    tick(SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();
    const req = flushList([]);
    expect(req.request.params.get('needsReview')).toBe('true');
    expect(el.querySelector('[data-testid="needs-review-chip"]')?.textContent).toContain('Needs review');
  }));

  it('"looks good" clears the flag (PATCH reviewed) and bulk approve posts selected ids', fakeAsync(() => {
    init();
    tick(SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();
    const list = [
      makeTx({ id: 1, needsReview: true }),
      makeTx({ id: 2, needsReview: true }),
      makeTx({ id: 3, needsReview: true }),
    ];
    flushList(list);
    page.markReviewed(list[0]);
    expect(page['rows']()[0].needsReview).toBeFalse();
    const patch = http.expectOne('/api/transactions/1');
    expect(patch.request.body).toEqual({ reviewed: true });
    patch.flush({ ...list[0], needsReview: false });
    expect(month.stub.refreshMonths).toHaveBeenCalledTimes(1);

    page['toggleAllReview'](true);
    fixture.detectChanges();
    expect(page['reviewableSelected']()).toEqual([2, 3]);
    el.querySelector<HTMLButtonElement>('[data-testid="bulk-approve"]')!.click();
    const bulk = http.expectOne('/api/transactions/review');
    expect(bulk.request.body).toEqual({ ids: [2, 3] });
    bulk.flush({ updated: 2 });
    expect(page['rows']().every((r) => !r.needsReview)).toBeTrue();
    expect(page['selected']().size).toBe(0);
    expect(month.stub.refreshMonths).toHaveBeenCalledTimes(2);
    http.expectNone('/api/categories'); // review doesn't change category counts
  }));

  it('opens the split dialog and replaces the row with the result', fakeAsync(() => {
    init();
    tick(SEARCH_DEBOUNCE_MS);
    fixture.detectChanges();
    flushList();
    const updated = { ...txs[0], splits: [{ id: 9, categoryId: 1, categoryName: 'Food', amount: -4.5 }] };
    dialog.open.and.returnValue({ afterClosed: () => of(updated) });
    page.openSplit(txs[0]);
    expect(dialog.open.calls.mostRecent().args[1].data.transaction).toBe(txs[0]);
    expect(page['rows']()[0].splits.length).toBe(1);
    expectCountsRefreshed();
  }));
});
