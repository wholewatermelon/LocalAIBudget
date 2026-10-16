import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { setupHttp } from './api.spec-helpers';
import { INSIGHT_TIMEOUT_MS, InsightsApi } from './insights.api';

describe('InsightsApi', () => {
  let http: HttpTestingController;
  let api: InsightsApi;

  beforeEach(() => {
    http = setupHttp();
    api = TestBed.inject(InsightsApi);
  });
  afterEach(() => http.verify());

  it('GETs latest insight for a month (may be null)', () => {
    let result: unknown = 'unset';
    api.latest('2024-01').subscribe((r) => (result = r));
    const req = http.expectOne((r) => r.url === '/api/insights');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('month')).toBe('2024-01');
    req.flush(null);
    expect(result).toBeNull();
  });

  it('POSTs /api/insights/generate with month', () => {
    api.generate('2024-01').subscribe();
    const req = http.expectOne('/api/insights/generate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ month: '2024-01' });
    req.flush({});
  });

  it('times out generation after 120s', fakeAsync(() => {
    let error: unknown;
    api.generate('2024-01').subscribe({ error: (e) => (error = e) });
    const req = http.expectOne('/api/insights/generate');
    tick(INSIGHT_TIMEOUT_MS - 1);
    expect(error).toBeUndefined();
    tick(1);
    expect((error as Error).name).toBe('TimeoutError');
    expect(req.cancelled).toBeTrue();
  }));
});
