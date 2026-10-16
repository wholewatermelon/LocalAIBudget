import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { setupHttp } from './api.spec-helpers';
import { AccountsApi, CategoriesApi } from './categories.api';

describe('CategoriesApi', () => {
  let http: HttpTestingController;
  let api: CategoriesApi;

  beforeEach(() => {
    http = setupHttp();
    api = TestBed.inject(CategoriesApi);
  });
  afterEach(() => http.verify());

  it('GETs /api/categories', () => {
    api.list().subscribe();
    const req = http.expectOne('/api/categories');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('POSTs a new category', () => {
    api.create({ name: 'Pets', isIncome: false }).subscribe();
    const req = http.expectOne('/api/categories');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Pets', isIncome: false });
    req.flush({});
  });

  it('PATCHes a category', () => {
    api.update(3, { isTransfer: true }).subscribe();
    const req = http.expectOne('/api/categories/3');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ isTransfer: true });
    req.flush({});
  });

  it('DELETEs a category', () => {
    api.delete(3).subscribe();
    const req = http.expectOne('/api/categories/3');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});

describe('AccountsApi', () => {
  let http: HttpTestingController;
  let api: AccountsApi;

  beforeEach(() => {
    http = setupHttp();
    api = TestBed.inject(AccountsApi);
  });
  afterEach(() => http.verify());

  it('GETs /api/accounts', () => {
    api.list().subscribe();
    const req = http.expectOne('/api/accounts');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('PATCHes /api/accounts/:id', () => {
    api.update(1, { accountName: 'Joint' }).subscribe();
    const req = http.expectOne('/api/accounts/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ accountName: 'Joint' });
    req.flush({});
  });
});
