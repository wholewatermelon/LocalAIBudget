import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { makeMainBudget, makeMonthBudget } from '../../../testing/fixtures';
import { monthServiceStub } from '../../../testing/month-service.stub';
import { BudgetPage } from './budget.page';

describe('BudgetPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BudgetPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), monthServiceStub('2024-03')],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('opens on "This month" for the selected month', async () => {
    const fixture = TestBed.createComponent(BudgetPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    http.expectOne('/api/categories').flush([]);
    http.expectOne((r) => r.url === '/api/budget/month' && r.params.get('month') === '2024-03').flush(makeMonthBudget([]));
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Budget · Mar 2024');
    expect(el.querySelector('app-month-budget-tab')).not.toBeNull();
  });

  it('?tab=main opens the Main budget tab', async () => {
    const fixture = TestBed.createComponent(BudgetPage);
    fixture.componentRef.setInput('tab', 'main');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    http.expectOne('/api/categories').flush([]);
    http.expectOne((r) => r.url === '/api/budget/main' && r.params.get('month') === '2024-03').flush(makeMainBudget([]));
    expect((fixture.nativeElement as HTMLElement).querySelector('app-main-budget-tab')).not.toBeNull();
  });
});
