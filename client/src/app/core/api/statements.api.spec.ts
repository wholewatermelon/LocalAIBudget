import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { setupHttp } from './api.spec-helpers';
import { StatementsApi } from './statements.api';

describe('StatementsApi', () => {
  let http: HttpTestingController;
  let api: StatementsApi;

  beforeEach(() => {
    http = setupHttp();
    api = TestBed.inject(StatementsApi);
  });
  afterEach(() => http.verify());

  it('GETs /api/months', () => {
    api.months().subscribe();
    const req = http.expectOne('/api/months');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('GETs /api/statements with month param', () => {
    api.list('2024-01').subscribe();
    const req = http.expectOne((r) => r.url === '/api/statements');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('month')).toBe('2024-01');
    req.flush([]);
  });

  it('POSTs multipart upload with files[] and month', () => {
    const a = new File(['x'], 'Main_Checking.pdf', { type: 'application/pdf' });
    const b = new File(['y'], 'card.csv', { type: 'text/csv' });
    api.upload([a, b], '2024-02').subscribe();
    const req = http.expectOne('/api/statements/upload');
    expect(req.request.method).toBe('POST');
    const form = req.request.body as FormData;
    expect(form instanceof FormData).toBeTrue();
    const files = form.getAll('files') as File[];
    expect(files.map((f) => f.name)).toEqual(['Main_Checking.pdf', 'card.csv']);
    expect(form.get('month')).toBe('2024-02');
    req.flush([]);
  });

  it('omits month field when not given', () => {
    api.upload([new File(['x'], 'Main_Checking_2024-01.pdf')]).subscribe();
    const req = http.expectOne('/api/statements/upload');
    expect((req.request.body as FormData).has('month')).toBeFalse();
    req.flush([]);
  });

  it('DELETEs /api/statements/:id', () => {
    api.delete(7).subscribe();
    const req = http.expectOne('/api/statements/7');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
