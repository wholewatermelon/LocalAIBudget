import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_ERROR_SNACKBAR } from '../http-context';
import { Health } from '../models';
import { setupHttp } from './api.spec-helpers';
import { HealthApi } from './health.api';

describe('HealthApi', () => {
  let http: HttpTestingController;
  let api: HealthApi;

  beforeEach(() => {
    http = setupHttp();
    api = TestBed.inject(HealthApi);
  });
  afterEach(() => http.verify());

  it('GETs /api/health silently (no global snackbar)', () => {
    const body: Health = { db: 'ok', ollama: 'ok', model: 'gemma4', modelAvailable: true };
    let result: Health | undefined;
    api.get().subscribe((h) => (result = h));
    const req = http.expectOne('/api/health');
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(SKIP_ERROR_SNACKBAR)).toBeTrue();
    req.flush(body);
    expect(result).toEqual(body);
  });
});
