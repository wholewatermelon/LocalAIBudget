import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { makeCategory, makeMainBudget, makeMainItem } from '../../../testing/fixtures';
import { NotifyService } from '../../core/notify.service';
import { ApplyStartingDialog } from './apply-starting-dialog';
import { MainBudgetTab } from './main-budget-tab';
import { SeedDialog } from './seed-dialog';

describe('MainBudgetTab', () => {
  let fixture: ComponentFixture<MainBudgetTab>;
  let tab: MainBudgetTab;
  let http: HttpTestingController;
  let dialog: { open: jasmine.Spy };
  let dialogResult: unknown;
  let el: HTMLElement;

  const main = makeMainBudget([
    makeMainItem({ categoryId: 1, categoryName: 'Food', amount: 400 }),
    makeMainItem({ categoryId: 2, categoryName: 'Housing', amount: 1000, hasLaterChange: true }),
  ]);

  beforeEach(() => {
    dialogResult = '2024-03';
    dialog = { open: jasmine.createSpy('open').and.callFake(() => ({ afterClosed: () => of(dialogResult) })) };
    TestBed.configureTestingModule({
      imports: [MainBudgetTab],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: dialog },
        { provide: NotifyService, useValue: jasmine.createSpyObj('NotifyService', ['info', 'error']) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MainBudgetTab);
    tab = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.componentRef.setInput('month', '2024-03');
    fixture.detectChanges();
    http.expectOne('/api/categories').flush([
      makeCategory({ id: 1, name: 'Food' }),
      makeCategory({ id: 2, name: 'Housing' }),
      makeCategory({ id: 3, name: 'Gym' }),
      makeCategory({ id: 7, name: 'Income', isIncome: true }),
    ]);
    http.expectOne((r) => r.url === '/api/budget/main' && r.params.get('month') === '2024-03').flush(main);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  function flushReload() {
    http.expectOne((r) => r.url === '/api/budget/main').flush(main);
  }

  it('renders rows, "changes later" hint and total', () => {
    expect(el.querySelectorAll('[data-testid="main-row"]').length).toBe(2);
    expect(el.textContent).toContain('changes later');
    expect(el.querySelector('[data-testid="main-total"]')?.textContent).toContain('$1,400.00');
  });

  it('editing asks "Apply starting" (default = selected month) then PUTs the version', () => {
    tab.edit(main.items[0], '450');
    expect(dialog.open.calls.mostRecent().args[0]).toBe(ApplyStartingDialog);
    expect(dialog.open.calls.mostRecent().args[1].data.defaultMonth).toBe('2024-03');
    const req = http.expectOne({ method: 'PUT', url: '/api/budget/main/items/1' });
    expect(req.request.body).toEqual({ amount: 450, effectiveFrom: '2024-03' });
    req.flush(main);
    flushReload();
  });

  it('uses the month chosen in the prompt', () => {
    dialogResult = '2024-06';
    tab.edit(main.items[0], '450');
    const req = http.expectOne('/api/budget/main/items/1');
    expect(req.request.body.effectiveFrom).toBe('2024-06');
    req.flush(main);
    flushReload();
  });

  it('cancelling the prompt writes nothing and restores the inputs', () => {
    dialogResult = undefined;
    tab.edit(main.items[0], '450');
    http.expectNone('/api/budget/main/items/1');
    flushReload();
  });

  it('remove PUTs amount null from the chosen month', () => {
    tab.remove(main.items[1]);
    const req = http.expectOne({ method: 'PUT', url: '/api/budget/main/items/2' });
    expect(req.request.body).toEqual({ amount: null, effectiveFrom: '2024-03' });
    req.flush(main);
    flushReload();
  });

  it('add offers spending categories not in main and PUTs after the prompt', () => {
    expect(tab['addable']().map((c) => c.name)).toEqual(['Gym']);
    tab['addCategoryId'].set(3);
    tab['addAmount'].set(40);
    tab.add();
    const req = http.expectOne({ method: 'PUT', url: '/api/budget/main/items/3' });
    expect(req.request.body).toEqual({ amount: 40, effectiveFrom: '2024-03' });
    req.flush(main);
    flushReload();
    expect(tab['addCategoryId']()).toBeNull();
  });

  it('shows history and can undo a version', () => {
    tab.toggleHistory(main.items[0]);
    http
      .expectOne((r) => r.url === '/api/budget/main/history' && r.params.get('categoryId') === '1')
      .flush([
        { effectiveFrom: '2024-01', amount: 350, createdAt: '2024-01-01T00:00:00Z' },
        { effectiveFrom: '2024-03', amount: 400, createdAt: '2024-03-01T00:00:00Z' },
      ]);
    fixture.detectChanges();
    const undo = el.querySelectorAll<HTMLButtonElement>('[data-testid="undo-version"]');
    expect(undo.length).toBe(2);
    undo[1].click();
    http.expectOne({ method: 'DELETE', url: '/api/budget/main/items/1/versions/2024-03' }).flush(null);
    flushReload();
    http.expectOne((r) => r.url === '/api/budget/main/history').flush([]);
  });

  it('opens the seed dialog with the current main and reloads after seeding', () => {
    dialogResult = makeMainBudget([], '2024-03');
    tab.openSeed();
    expect(dialog.open.calls.mostRecent().args[0]).toBe(SeedDialog);
    expect(dialog.open.calls.mostRecent().args[1].data).toEqual({ selectedMonth: '2024-03', currentMain: main.items });
    flushReload();
  });
});
