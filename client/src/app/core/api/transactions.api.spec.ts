import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_ERROR_SNACKBAR } from '../http-context';
import { setupHttp } from './api.spec-helpers';
import { TransactionsApi } from './transactions.api';

describe('TransactionsApi', () => {
  let http: HttpTestingController;
  let api: TransactionsApi;

  beforeEach(() => {
    http = setupHttp();
    api = TestBed.inject(TransactionsApi);
  });
  afterEach(() => http.verify());

  it('GETs /api/transactions with all filters', () => {
    api
      .list({ month: '2024-01', accountId: 2, categoryId: 5, uncategorized: true, search: '  coffee ' })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/api/transactions');
    expect(req.request.method).toBe('GET');
    const p = req.request.params;
    expect(p.get('month')).toBe('2024-01');
    expect(p.get('accountId')).toBe('2');
    expect(p.get('categoryId')).toBe('5');
    expect(p.get('uncategorized')).toBe('true');
    expect(p.get('search')).toBe('coffee');
    req.flush([]);
  });

  it('omits empty filters', () => {
    api.list({ month: '2024-01', accountId: null, categoryId: null, uncategorized: false, search: ' ' }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/transactions');
    expect(req.request.params.keys()).toEqual(['month']);
    req.flush([]);
  });

  it('keeps id 0 filters (only null/undefined are omitted)', () => {
    api.list({ accountId: 0 }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/transactions');
    expect(req.request.params.get('accountId')).toBe('0');
    req.flush([]);
  });

  it('PATCHes category silently', () => {
    api.setCategory(3, 9).subscribe();
    const req = http.expectOne('/api/transactions/3');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ categoryId: 9 });
    expect(req.request.context.get(SKIP_ERROR_SNACKBAR)).toBeTrue();
    req.flush({});
  });

  it('PATCHes categoryId null to uncategorize', () => {
    api.setCategory(3, null).subscribe();
    const req = http.expectOne('/api/transactions/3');
    expect(req.request.body).toEqual({ categoryId: null });
    req.flush({});
  });

  it('PUTs splits', () => {
    const splits = [
      { categoryId: 1, amount: -10 },
      { categoryId: 2, amount: -5.5 },
    ];
    api.setSplits(4, splits).subscribe();
    const req = http.expectOne('/api/transactions/4/splits');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ splits });
    req.flush({});
  });

  it('passes needsReview=true', () => {
    api.list({ month: '2024-01', needsReview: true }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/transactions');
    expect(req.request.params.get('needsReview')).toBe('true');
    req.flush([]);
  });

  it('PATCHes { reviewed: true } for "looks good"', () => {
    api.markReviewed(8).subscribe();
    const req = http.expectOne('/api/transactions/8');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ reviewed: true });
    req.flush({});
  });

  it('POSTs bulk review ids', () => {
    let result: { updated: number } | undefined;
    api.bulkReview([1, 2, 3]).subscribe((r) => (result = r));
    const req = http.expectOne('/api/transactions/review');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ids: [1, 2, 3] });
    req.flush({ updated: 3 });
    expect(result).toEqual({ updated: 3 });
  });

  it('PUTs empty splits to clear', () => {
    api.setSplits(4, []).subscribe();
    const req = http.expectOne('/api/transactions/4/splits');
    expect(req.request.body).toEqual({ splits: [] });
    req.flush({});
  });
});
