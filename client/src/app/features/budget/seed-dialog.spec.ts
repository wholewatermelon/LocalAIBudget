import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { makeMainBudget, makeMainItem } from '../../../testing/fixtures';
import { ApplyStartingDialog } from './apply-starting-dialog';
import { SeedDialog } from './seed-dialog';

describe('SeedDialog', () => {
  let fixture: ComponentFixture<SeedDialog>;
  let dlg: SeedDialog;
  let http: HttpTestingController;
  let ref: jasmine.SpyObj<MatDialogRef<SeedDialog>>;
  let el: HTMLElement;

  beforeEach(() => {
    ref = jasmine.createSpyObj('MatDialogRef', ['close']);
    TestBed.configureTestingModule({
      imports: [SeedDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: ref },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            selectedMonth: '2024-03',
            currentMain: [makeMainItem({ categoryId: 1, categoryName: 'Food', amount: 400 }), makeMainItem({ categoryId: 4, categoryName: 'Gym', amount: 40 })],
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SeedDialog);
    dlg = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('defaults: from previous month, actual, round 25, start = selected month', () => {
    expect(dlg['form']()).toEqual({ fromMonth: '2024-02', source: 'actual', averageMonths: 3, roundTo: 25, effectiveFrom: '2024-03' });
  });

  it('previews current vs proposed (incl. removed) and seeds with the previewed settings', () => {
    dlg['source'].set('average');
    dlg['averageMonths'].set(6);
    dlg.loadPreview();
    const p = http.expectOne('/api/budget/main/seed/preview');
    expect(p.request.body).toEqual({ fromMonth: '2024-02', source: 'average', averageMonths: 6, roundTo: 25, effectiveFrom: '2024-03' });
    p.flush({
      items: [
        { categoryId: 1, categoryName: 'Food', amount: 425, currentMainAmount: 400 },
        { categoryId: 2, categoryName: 'Restaurants', amount: 150, currentMainAmount: null },
      ],
      total: 575,
    });
    fixture.detectChanges();
    const table = el.querySelector('[data-testid="seed-preview"]')!;
    expect(table.textContent).toContain('Gym');
    expect(table.textContent).toContain('removed');
    expect(table.textContent).toContain('$575.00');

    el.querySelector<HTMLButtonElement>('[data-testid="seed-confirm"]')!.click();
    const s = http.expectOne('/api/budget/main/seed');
    expect(s.request.body).toEqual(p.request.body);
    const result = makeMainBudget([]);
    s.flush(result);
    expect(ref.close).toHaveBeenCalledWith(result);
  });

  it('disables confirm when the form changes after the preview', () => {
    dlg.loadPreview();
    http.expectOne('/api/budget/main/seed/preview').flush({ items: [{ categoryId: 1, categoryName: 'Food', amount: 425, currentMainAmount: 400 }], total: 425 });
    fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('[data-testid="seed-confirm"]')!.disabled).toBeFalse();
    dlg['roundTo'].set(50);
    fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('[data-testid="seed-confirm"]')!.disabled).toBeTrue();
  });

  it('shows preview errors inline', () => {
    dlg.loadPreview();
    http.expectOne('/api/budget/main/seed/preview').flush({ message: 'fromMonth has no data' }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('fromMonth has no data');
  });
});

describe('ApplyStartingDialog', () => {
  it('defaults to the given month, validates, and closes with the chosen month', () => {
    const ref = jasmine.createSpyObj('MatDialogRef', ['close']);
    TestBed.configureTestingModule({
      imports: [ApplyStartingDialog],
      providers: [
        { provide: MatDialogRef, useValue: ref },
        { provide: MAT_DIALOG_DATA, useValue: { summary: 'Food → $450.00', defaultMonth: '2024-03' } },
      ],
    });
    const fixture = TestBed.createComponent(ApplyStartingDialog);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Earlier months keep the budget they had');
    const c = fixture.componentInstance;
    c['month'].set('2024-13');
    fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('[data-testid="apply-starting-confirm"]')!.disabled).toBeTrue();
    c['month'].set('2024-05');
    c.confirm();
    expect(ref.close).toHaveBeenCalledWith('2024-05');
  });
});
