import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { makeCategory, makeTx } from '../../../testing/fixtures';
import { SplitDialog, SplitDialogData } from './split-dialog';

describe('SplitDialog', () => {
  let fixture: ComponentFixture<SplitDialog>;
  let dialog: SplitDialog;
  let http: HttpTestingController;
  let ref: jasmine.SpyObj<MatDialogRef<SplitDialog>>;
  let el: HTMLElement;

  function setup(data: SplitDialogData) {
    ref = jasmine.createSpyObj('MatDialogRef', ['close']);
    TestBed.configureTestingModule({
      imports: [SplitDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: ref },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SplitDialog);
    dialog = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  }
  afterEach(() => http.verify());

  const categories = [makeCategory({ id: 1, name: 'Food' }), makeCategory({ id: 3, name: 'Shopping' })];

  it('starts with the full amount + an empty row and shows live remaining', () => {
    setup({ transaction: makeTx({ id: 5, amount: -100, categoryId: 1 }), categories });
    expect(el.querySelectorAll('[data-testid="split-row"]').length).toBe(2);
    expect(el.querySelector('[data-testid="remaining"]')?.textContent).toContain('$0.00');
    dialog.patch(0, { amount: -70 });
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="remaining"]')?.textContent).toContain('-$30.00');
    expect(el.querySelector<HTMLButtonElement>('[data-testid="save-splits"]')!.disabled).toBeTrue();
  });

  it('fill remaining + save PUTs normalized splits and closes with the result', () => {
    setup({ transaction: makeTx({ id: 5, amount: -100, categoryId: 1 }), categories });
    dialog.patch(0, { amount: -70.1 });
    dialog.patch(1, { categoryId: 3 });
    dialog.fillRemaining(1);
    fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('[data-testid="save-splits"]')!.disabled).toBeFalse();
    dialog.save();
    const req = http.expectOne({ method: 'PUT', url: '/api/transactions/5/splits' });
    expect(req.request.body).toEqual({
      splits: [
        { categoryId: 1, amount: -70.1 },
        { categoryId: 3, amount: -29.9 },
      ],
    });
    const updated = makeTx({ id: 5 });
    req.flush(updated);
    expect(ref.close).toHaveBeenCalledWith(updated);
  });

  it('shows server validation errors inline and stays open', () => {
    setup({ transaction: makeTx({ id: 5, amount: -10, categoryId: 1 }), categories });
    dialog.removeRow(1);
    dialog.save();
    http.expectOne('/api/transactions/5/splits').flush({ message: 'Sum mismatch' }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Sum mismatch');
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('can clear existing splits (PUT [])', () => {
    setup({
      transaction: makeTx({ id: 6, amount: -10, splits: [{ id: 1, categoryId: 1, categoryName: 'Food', amount: -10 }] }),
      categories,
    });
    expect(el.querySelectorAll('[data-testid="split-row"]').length).toBe(1);
    dialog.clear();
    const req = http.expectOne('/api/transactions/6/splits');
    expect(req.request.body).toEqual({ splits: [] });
    req.flush(makeTx({ id: 6 }));
    expect(ref.close).toHaveBeenCalled();
  });
});
