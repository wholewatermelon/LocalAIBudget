import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeCategory, makeMonthBudget, makeMonthItem } from '../../../testing/fixtures';
import { NotifyService } from '../../core/notify.service';
import { MonthBudgetTab, NEW_CATEGORY } from './month-budget-tab';

describe('MonthBudgetTab', () => {
  let fixture: ComponentFixture<MonthBudgetTab>;
  let tab: MonthBudgetTab;
  let http: HttpTestingController;
  let notify: jasmine.SpyObj<NotifyService>;
  let el: HTMLElement;
  let changed: number;

  const items = [
    makeMonthItem({ categoryId: 1, categoryName: 'Food' }),
    makeMonthItem({ categoryId: 2, categoryName: 'Gifts', source: 'adjusted', mainAmount: 50, adjustedAmount: 200, effectiveAmount: 200, note: 'birthday', spent: 220, remaining: -20 }),
    makeMonthItem({ categoryId: 3, categoryName: 'Travel', source: 'month-only', mainAmount: null, adjustedAmount: 500, effectiveAmount: 500, spent: 0, remaining: 500 }),
    makeMonthItem({ categoryId: 4, categoryName: 'Gym', source: 'hidden', hidden: true, mainAmount: 40, effectiveAmount: null, spent: 0, remaining: null }),
    makeMonthItem({ categoryId: 5, categoryName: 'Pets', source: 'unbudgeted', mainAmount: null, effectiveAmount: null, spent: 30, remaining: null }),
  ];

  beforeEach(() => {
    notify = jasmine.createSpyObj<NotifyService>('NotifyService', ['info', 'error']);
    TestBed.configureTestingModule({
      imports: [MonthBudgetTab],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: NotifyService, useValue: notify }],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MonthBudgetTab);
    tab = fixture.componentInstance;
    el = fixture.nativeElement;
    changed = 0;
    tab.changed.subscribe(() => changed++);
    fixture.componentRef.setInput('month', '2024-03');
    fixture.detectChanges();
    http.expectOne('/api/categories').flush([
      makeCategory({ id: 1, name: 'Food' }),
      makeCategory({ id: 6, name: 'Clothes' }),
      makeCategory({ id: 7, name: 'Income', isIncome: true }),
      makeCategory({ id: 8, name: 'Transfer', isTransfer: true }),
    ]);
    http.expectOne((r) => r.url === '/api/budget/month' && r.params.get('month') === '2024-03').flush(makeMonthBudget(items));
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('renders rows with chips, greyed hidden rows, and totals', () => {
    const rows = Array.from(el.querySelectorAll('[data-testid="month-row"]'));
    expect(rows.length).toBe(5);
    const chips = rows.map((r) => r.querySelector('[data-testid="row-chip"]')?.textContent?.trim() ?? null);
    expect(chips).toEqual([null, 'adjusted', 'this month only', 'hidden', 'not budgeted']);
    expect(rows[3].classList).toContain('greyed');
    expect(rows[1].querySelector('[data-testid="reset"]')).not.toBeNull();
    expect(rows[3].querySelector('[data-testid="unhide"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="month-totals"]')?.textContent).toContain('$1,100.00'); // 400+200+500
  });

  it('editing an amount PUTs the month item and emits changed', () => {
    tab.editAmount(items[0], '450');
    const req = http.expectOne({ method: 'PUT', url: '/api/budget/month/2024-03/items/1' });
    expect(req.request.body).toEqual({ amount: 450 });
    req.flush(makeMonthBudget(items));
    expect(changed).toBe(1);
  });

  it('setting an adjusted row back to main (no note) resets instead', () => {
    tab.editAmount({ ...items[1], note: null }, '50');
    http.expectOne({ method: 'DELETE', url: '/api/budget/month/2024-03/items/2' }).flush(makeMonthBudget(items));
  });

  it('reset / hide / unhide', () => {
    tab.reset(items[1]);
    http.expectOne({ method: 'DELETE', url: '/api/budget/month/2024-03/items/2' }).flush(makeMonthBudget(items));
    tab.hide(items[0]);
    const hide = http.expectOne({ method: 'PUT', url: '/api/budget/month/2024-03/items/1' });
    expect(hide.request.body).toEqual({ hidden: true });
    hide.flush(makeMonthBudget(items));
    tab.unhide(items[3]);
    http.expectOne({ method: 'DELETE', url: '/api/budget/month/2024-03/items/4' }).flush(makeMonthBudget(items));
    expect(changed).toBe(3);
  });

  it('invalid input shows an error and reloads (restores the input)', () => {
    tab.editAmount(items[0], '-3');
    expect(notify.error).toHaveBeenCalled();
    http.expectOne((r) => r.url === '/api/budget/month').flush(makeMonthBudget(items));
  });

  it('server error on write shows a snackbar and reloads', () => {
    tab.editAmount(items[0], '450');
    http.expectOne({ method: 'PUT', url: '/api/budget/month/2024-03/items/1' }).flush({ message: 'bad' }, { status: 400, statusText: 'Bad' });
    expect(notify.error).toHaveBeenCalled();
    http.expectOne((r) => r.url === '/api/budget/month').flush(makeMonthBudget(items));
    expect(changed).toBe(0);
  });

  it('copies adjustments from the previous month', () => {
    el.querySelector<HTMLButtonElement>('[data-testid="copy-adjustments"]')!.click();
    const req = http.expectOne({ method: 'POST', url: '/api/budget/month/2024-03/copy-adjustments' });
    expect(req.request.body).toEqual({ fromMonth: '2024-02' });
    req.flush(makeMonthBudget(items));
    expect(notify.info).toHaveBeenCalled();
  });

  it('"add category" offers only unlisted spending categories', () => {
    expect(tab['addable']().map((c) => c.name)).toEqual(['Clothes']);
  });

  it('adds an existing category for this month', () => {
    tab['addCategoryId'].set(6);
    tab['addAmount'].set(75);
    tab.add();
    const req = http.expectOne({ method: 'PUT', url: '/api/budget/month/2024-03/items/6' });
    expect(req.request.body).toEqual({ amount: 75 });
    req.flush(makeMonthBudget(items));
    expect(tab['addCategoryId']()).toBeNull();
  });

  it('creates a new category inline, then budgets it for this month', () => {
    tab['addCategoryId'].set(NEW_CATEGORY);
    tab['addAmount'].set(120);
    expect(tab['canAdd']()).toBeFalse(); // needs a name
    tab['addNewName'].set('Vet');
    tab.add();
    const create = http.expectOne({ method: 'POST', url: '/api/categories' });
    expect(create.request.body).toEqual({ name: 'Vet' });
    create.flush(makeCategory({ id: 42, name: 'Vet' }));
    const put = http.expectOne({ method: 'PUT', url: '/api/budget/month/2024-03/items/42' });
    expect(put.request.body).toEqual({ amount: 120 });
    put.flush(makeMonthBudget(items));
    expect(changed).toBe(1);
  });
});
