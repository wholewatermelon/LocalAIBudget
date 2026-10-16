import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { makeCategory } from '../../../testing/fixtures';
import { NotifyService } from '../../core/notify.service';
import { CategoriesPage } from './categories.page';

describe('CategoriesPage', () => {
  let fixture: ComponentFixture<CategoriesPage>;
  let page: CategoriesPage;
  let http: HttpTestingController;
  let notify: jasmine.SpyObj<NotifyService>;
  let el: HTMLElement;

  beforeEach(() => {
    notify = jasmine.createSpyObj<NotifyService>('NotifyService', ['info', 'error']);
    TestBed.configureTestingModule({
      imports: [CategoriesPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotifyService, useValue: notify },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(true) }) } },
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CategoriesPage);
    page = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
    http.expectOne('/api/categories').flush([
      makeCategory({ id: 1, name: 'Food', transactionCount: 4 }),
      makeCategory({ id: 2, name: 'Transfer', isTransfer: true }),
      makeCategory({ id: 3, name: 'Income', isIncome: true }),
    ]);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('renders editable rows with the transfer flag', () => {
    const rows = el.querySelectorAll('[data-testid="category-row"]');
    expect(rows.length).toBe(3);
    const checked = Array.from(el.querySelectorAll('[data-testid="row-transfer"] input')).map(
      (i) => (i as HTMLInputElement).checked,
    );
    expect(checked).toEqual([false, false, true]); // sorted: Food, Income, Transfer
  });

  it('creates a transfer category', () => {
    page['newName'].set('Card Payments');
    page['newTransfer'].set(true);
    page.add();
    const req = http.expectOne({ method: 'POST', url: '/api/categories' });
    expect(req.request.body).toEqual({ name: 'Card Payments', isIncome: false, isTransfer: true });
    req.flush(makeCategory({ id: 10, name: 'Card Payments', isTransfer: true }));
    expect(page['newTransfer']()).toBeFalse();
  });

  it('toggles isTransfer on an existing category (only when changed)', () => {
    const food = page['store'].categories()[0];
    page.save(food, { isTransfer: false });
    http.expectNone('/api/categories/1');
    page.save(food, { isTransfer: true });
    const req = http.expectOne({ method: 'PATCH', url: '/api/categories/1' });
    expect(req.request.body).toEqual({ isTransfer: true });
    req.flush(makeCategory({ id: 1, name: 'Food', isTransfer: true }));
    expect(page['store'].byId().get(1)?.isTransfer).toBeTrue();
  });

  it('adds a category', () => {
    page['newName'].set('Pets');
    page.add();
    const req = http.expectOne({ method: 'POST', url: '/api/categories' });
    expect(req.request.body).toEqual({ name: 'Pets', isIncome: false, isTransfer: false });
    req.flush(makeCategory({ id: 9, name: 'Pets' }));
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-testid="category-row"]').length).toBe(4);
  });

  it('shows a friendly message on duplicate name (409)', () => {
    page['newName'].set('Food');
    page.add();
    http.expectOne('/api/categories').flush({ message: 'exists' }, { status: 409, statusText: 'Conflict' });
    expect(notify.error).toHaveBeenCalledWith('A category named "Food" already exists.');
  });

  it('has no budget column and links to the Budget page', () => {
    expect(el.textContent).not.toContain('Monthly budget');
    const link = el.querySelector<HTMLAnchorElement>('[data-testid="edit-budgets"]')!;
    expect(link.getAttribute('href')).toContain('/budget');
    expect(link.getAttribute('href')).toContain('tab=main');
  });

  it('renames a category only when the name changed', () => {
    const food = page['store'].categories()[0];
    page.save(food, { name: ' Food ' });
    http.expectNone('/api/categories/1');
    page.save(food, { name: 'Groceries' });
    const req = http.expectOne({ method: 'PATCH', url: '/api/categories/1' });
    expect(req.request.body).toEqual({ name: 'Groceries' });
    req.flush(makeCategory({ id: 1, name: 'Groceries' }));
  });

  it('explains a 409 on delete (category in use)', () => {
    const food = page['store'].categories()[0];
    page.remove(food);
    http.expectOne({ method: 'DELETE', url: '/api/categories/1' }).flush({ message: 'in use' }, { status: 409, statusText: 'Conflict' });
    expect(notify.error.calls.mostRecent().args[0]).toContain('still used by transactions');
    expect(page['store'].categories().length).toBe(3);
  });

  it('deletes an unused category', () => {
    const transfer = page['store'].categories().find((c) => c.name === 'Transfer')!;
    page.remove(transfer);
    http.expectOne({ method: 'DELETE', url: '/api/categories/2' }).flush(null, { status: 204, statusText: 'No Content' });
    expect(page['store'].categories().length).toBe(2);
  });
});
