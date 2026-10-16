import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { makeCategory } from '../../testing/fixtures';
import { setupHttp } from './api/api.spec-helpers';
import { CategoryStore } from './category.store';
import { isNonSpendingCategory, isTransfer, isTransferCategory } from './category-utils';

describe('CategoryStore', () => {
  let http: HttpTestingController;
  let store: CategoryStore;

  beforeEach(() => {
    http = setupHttp();
    store = TestBed.inject(CategoryStore);
  });
  afterEach(() => http.verify());

  it('loads and sorts categories by name', () => {
    store.load();
    expect(store.loading()).toBeTrue();
    http.expectOne('/api/categories').flush([makeCategory({ id: 2, name: 'Utilities' }), makeCategory({ id: 1, name: 'Food' })]);
    expect(store.loading()).toBeFalse();
    expect(store.loaded()).toBeTrue();
    expect(store.categories().map((c) => c.name)).toEqual(['Food', 'Utilities']);
    expect(store.byId().get(2)?.name).toBe('Utilities');
  });

  it('ensureLoaded() only fetches once', () => {
    store.ensureLoaded();
    store.ensureLoaded();
    http.expectOne('/api/categories').flush([]);
    store.ensureLoaded();
    http.expectNone('/api/categories');
  });

  it('create/update/delete keep local state in sync', () => {
    store.load();
    http.expectOne('/api/categories').flush([makeCategory({ id: 1, name: 'Food' })]);

    store.create({ name: 'Pets' }).subscribe();
    http.expectOne({ method: 'POST', url: '/api/categories' }).flush(makeCategory({ id: 5, name: 'Pets' }));
    expect(store.categories().length).toBe(2);

    store.update(1, { name: 'Groceries' }).subscribe();
    http.expectOne({ method: 'PATCH', url: '/api/categories/1' }).flush(makeCategory({ id: 1, name: 'Groceries' }));
    expect(store.byId().get(1)?.name).toBe('Groceries');

    store.delete(5).subscribe();
    http.expectOne({ method: 'DELETE', url: '/api/categories/5' }).flush(null);
    expect(store.categories().map((c) => c.id)).toEqual([1]);
  });

  it('does not change state when a write fails', () => {
    store.load();
    http.expectOne('/api/categories').flush([makeCategory({ id: 1 })]);
    store.delete(1).subscribe({ error: () => undefined });
    http.expectOne('/api/categories/1').flush({ message: 'in use' }, { status: 409, statusText: 'Conflict' });
    expect(store.categories().length).toBe(1);
  });
});

describe('category utils', () => {
  it('detects Transfer by name, case-insensitively', () => {
    expect(isTransferCategory('Transfer')).toBeTrue();
    expect(isTransferCategory(' transfer ')).toBeTrue();
    expect(isTransferCategory('Transfers out')).toBeFalse();
    expect(isTransferCategory(null)).toBeFalse();
  });

  it('isTransfer() uses the flag when present, name only as a fallback', () => {
    expect(isTransfer({ name: 'Card Payments', isTransfer: true })).toBeTrue();
    expect(isTransfer({ name: 'Transfer', isTransfer: false })).toBeFalse();
    expect(isTransfer({ name: 'Transfer' })).toBeTrue(); // older payload without the field
    expect(isTransfer({ name: 'Food', isTransfer: null })).toBeFalse();
  });

  it('income and transfer are non-spending', () => {
    expect(isNonSpendingCategory({ name: 'Card Payments', isIncome: false, isTransfer: true })).toBeTrue();
    expect(isNonSpendingCategory({ name: 'Transfer', isIncome: false, isTransfer: false })).toBeFalse();
    expect(isNonSpendingCategory({ name: 'Income', isIncome: true })).toBeTrue();
    expect(isNonSpendingCategory({ name: 'Transfer', isIncome: false })).toBeTrue();
    expect(isNonSpendingCategory({ name: 'Food', isIncome: false })).toBeFalse();
  });
});
