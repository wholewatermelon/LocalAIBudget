import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { setupHttp } from './api.spec-helpers';
import { BudgetApi } from './budget.api';

describe('BudgetApi', () => {
  let http: HttpTestingController;
  let api: BudgetApi;

  beforeEach(() => {
    http = setupHttp();
    api = TestBed.inject(BudgetApi);
  });
  afterEach(() => http.verify());

  it('GETs /api/budget/summary?month=', () => {
    api.summary('2024-01').subscribe();
    const req = http.expectOne((r) => r.url === '/api/budget/summary');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('month')).toBe('2024-01');
    req.flush({});
  });

  it('GETs /api/budget/trend?months=6 by default (no month anchor)', () => {
    api.trend().subscribe();
    const req = http.expectOne((r) => r.url === '/api/budget/trend');
    expect(req.request.params.get('months')).toBe('6');
    expect(req.request.params.has('month')).toBeFalse();
    req.flush([]);
  });

  it('anchors the trend at a month', () => {
    api.trend(6, '2024-03').subscribe();
    const req = http.expectOne((r) => r.url === '/api/budget/trend');
    expect(req.request.params.get('months')).toBe('6');
    expect(req.request.params.get('month')).toBe('2024-03');
    req.flush([]);
  });
});
