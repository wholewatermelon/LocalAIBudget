import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_ERROR_SNACKBAR } from '../http-context';
import { setupHttp } from './api.spec-helpers';
import { RulesApi } from './rules.api';

describe('RulesApi', () => {
  let http: HttpTestingController;
  let api: RulesApi;

  beforeEach(() => {
    http = setupHttp();
    api = TestBed.inject(RulesApi);
  });
  afterEach(() => http.verify());

  it('GETs /api/rules', () => {
    api.list().subscribe();
    const req = http.expectOne('/api/rules');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('POSTs a rule with applyToExisting', () => {
    const body = { pattern: 'AMZN MKTP', matchType: 'contains' as const, categoryId: 4, applyToExisting: true };
    api.create(body).subscribe();
    const req = http.expectOne('/api/rules');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    expect(req.request.context.get(SKIP_ERROR_SNACKBAR)).toBeTrue();
    req.flush({});
  });

  it('PATCHes and DELETEs /api/rules/:id', () => {
    api.update(3, { priority: 5 }).subscribe();
    const patch = http.expectOne('/api/rules/3');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ priority: 5 });
    patch.flush({});

    api.delete(3).subscribe();
    const del = http.expectOne('/api/rules/3');
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('POSTs /api/rules/preview silently', () => {
    api.preview('NETFLIX', 'starts_with').subscribe();
    const req = http.expectOne('/api/rules/preview');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ pattern: 'NETFLIX', matchType: 'starts_with' });
    expect(req.request.context.get(SKIP_ERROR_SNACKBAR)).toBeTrue();
    req.flush({ matchCount: 0, sample: [] });
  });

  it('GETs /api/rules/suggest?transactionId= silently', () => {
    api.suggest(42).subscribe();
    const req = http.expectOne((r) => r.url === '/api/rules/suggest');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('transactionId')).toBe('42');
    expect(req.request.context.get(SKIP_ERROR_SNACKBAR)).toBeTrue();
    req.flush({ pattern: 'AMZN MKTP', matchType: 'contains', matchCount: 12 });
  });
});
