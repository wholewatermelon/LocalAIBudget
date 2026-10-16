import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_ERROR_SNACKBAR } from '../http-context';
import { setupHttp } from './api.spec-helpers';
import { BudgetPlanApi } from './budget-plan.api';

describe('BudgetPlanApi', () => {
  let http: HttpTestingController;
  let api: BudgetPlanApi;

  beforeEach(() => {
    http = setupHttp();
    api = TestBed.inject(BudgetPlanApi);
  });
  afterEach(() => http.verify());

  it('GETs the main budget as of a month', () => {
    api.main('2024-03').subscribe();
    const req = http.expectOne((r) => r.url === '/api/budget/main');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('month')).toBe('2024-03');
    req.flush({ month: '2024-03', items: [], total: 0 });
  });

  it('GETs version history for a category', () => {
    api.history(4).subscribe();
    const req = http.expectOne((r) => r.url === '/api/budget/main/history');
    expect(req.request.params.get('categoryId')).toBe('4');
    req.flush([]);
  });

  it('PUTs a main item version (amount or null) silently', () => {
    api.setMainItem(4, 250, '2024-03').subscribe();
    const req = http.expectOne('/api/budget/main/items/4');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ amount: 250, effectiveFrom: '2024-03' });
    expect(req.request.context.get(SKIP_ERROR_SNACKBAR)).toBeTrue();
    req.flush({});

    api.setMainItem(4, null, '2024-05').subscribe();
    const rm = http.expectOne('/api/budget/main/items/4');
    expect(rm.request.body).toEqual({ amount: null, effectiveFrom: '2024-05' });
    rm.flush({});
  });

  it('DELETEs a main version', () => {
    api.deleteMainVersion(4, '2024-03').subscribe();
    const req = http.expectOne('/api/budget/main/items/4/versions/2024-03');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('POSTs seed preview and seed with the same body', () => {
    const body = { fromMonth: '2024-02', source: 'average' as const, averageMonths: 3, roundTo: 25 as const, effectiveFrom: '2024-03' };
    api.seedPreview(body).subscribe();
    const p = http.expectOne('/api/budget/main/seed/preview');
    expect(p.request.method).toBe('POST');
    expect(p.request.body).toEqual(body);
    p.flush({ items: [], total: 0 });

    api.seed(body).subscribe();
    const s = http.expectOne('/api/budget/main/seed');
    expect(s.request.method).toBe('POST');
    expect(s.request.body).toEqual(body);
    s.flush({});
  });

  it('GETs the month view', () => {
    api.month('2024-03').subscribe();
    const req = http.expectOne((r) => r.url === '/api/budget/month');
    expect(req.request.params.get('month')).toBe('2024-03');
    req.flush({});
  });

  it('PUTs and DELETEs month items', () => {
    api.setMonthItem('2024-03', 2, { amount: 120, note: 'birthday' }).subscribe();
    const put = http.expectOne('/api/budget/month/2024-03/items/2');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ amount: 120, note: 'birthday' });
    expect(put.request.context.get(SKIP_ERROR_SNACKBAR)).toBeTrue();
    put.flush({});

    api.resetMonthItem('2024-03', 2).subscribe();
    const del = http.expectOne('/api/budget/month/2024-03/items/2');
    expect(del.request.method).toBe('DELETE');
    del.flush({});
  });

  it('POSTs copy-adjustments', () => {
    api.copyAdjustments('2024-03', '2024-02').subscribe();
    const req = http.expectOne('/api/budget/month/2024-03/copy-adjustments');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ fromMonth: '2024-02' });
    req.flush({});
  });
});
