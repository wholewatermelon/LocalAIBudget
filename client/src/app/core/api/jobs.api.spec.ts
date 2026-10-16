import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { setupHttp } from './api.spec-helpers';
import { JobsApi } from './jobs.api';

describe('JobsApi', () => {
  let http: HttpTestingController;
  let api: JobsApi;

  beforeEach(() => {
    http = setupHttp();
    api = TestBed.inject(JobsApi);
  });
  afterEach(() => http.verify());

  it('POSTs /api/jobs/process with month + default incremental mode', () => {
    api.process('2024-01').subscribe();
    const req = http.expectOne('/api/jobs/process');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ month: '2024-01', mode: 'incremental' });
    req.flush({});
  });

  it('POSTs recategorize mode', () => {
    api.process('2024-01', 'recategorize').subscribe();
    const req = http.expectOne('/api/jobs/process');
    expect(req.request.body).toEqual({ month: '2024-01', mode: 'recategorize' });
    req.flush({});
  });

  it('GETs /api/jobs/:id', () => {
    api.get(12).subscribe();
    const req = http.expectOne('/api/jobs/12');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('GETs /api/jobs with month and limit', () => {
    api.list('2024-03').subscribe();
    const req = http.expectOne((r) => r.url === '/api/jobs');
    expect(req.request.params.get('month')).toBe('2024-03');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush([]);
  });

  it('GETs /api/jobs without month', () => {
    api.list(null, 5).subscribe();
    const req = http.expectOne((r) => r.url === '/api/jobs');
    expect(req.request.params.has('month')).toBeFalse();
    expect(req.request.params.get('limit')).toBe('5');
    req.flush([]);
  });
});
