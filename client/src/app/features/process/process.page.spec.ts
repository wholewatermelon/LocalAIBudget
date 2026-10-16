import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { makeFile, makeJob } from '../../../testing/fixtures';
import { monthServiceStub } from '../../../testing/month-service.stub';
import { NotifyService } from '../../core/notify.service';
import { MONTH_IN_NAME, ProcessPage, RECATEGORIZE_CONFIRM } from './process.page';
import { fileIcon, parseMethodLabel, reconciliationBadge } from './statement-list';
import { partitionFiles } from './upload-zone';

describe('ProcessPage', () => {
  let fixture: ComponentFixture<ProcessPage>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let month: ReturnType<typeof monthServiceStub>;
  let dialog: { open: jasmine.Spy };

  beforeEach(() => {
    month = monthServiceStub('2024-01');
    dialog = { open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(true) }) };
    TestBed.configureTestingModule({
      imports: [ProcessPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        month,
        { provide: MatDialog, useValue: dialog },
        { provide: NotifyService, useValue: jasmine.createSpyObj('NotifyService', ['info', 'error']) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProcessPage);
    el = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  function flushLoad(files = [makeFile(), makeFile({ id: 2, fileName: 'card_2024-01.csv', fileType: 'csv', lastParseMethod: 'csv' })], jobs = [makeJob({ id: 3, status: 'failed', errors: [{ file: 'x.pdf', line: 4, message: 'bad row' }] })]) {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/statements' && r.params.get('month') === '2024-01').flush(files);
    http.expectOne((r) => r.url === '/api/jobs' && r.params.get('month') === '2024-01').flush(jobs);
    fixture.detectChanges();
  }

  it('lists statement files (incl. CSV) and job history with expandable errors', () => {
    flushLoad();
    const files = el.querySelectorAll('[data-testid="statement-file"]');
    expect(files.length).toBe(2);
    expect(files[1].textContent).toContain('Parsed (CSV)');
    expect(files[1].textContent).toContain('table_view');
    expect(el.querySelectorAll('[data-testid="job-row"]').length).toBe(1);
    expect(el.querySelector('[data-testid="job-errors"]')).toBeNull();
    el.querySelector<HTMLButtonElement>('[data-testid="job-row"] button')!.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="job-errors"]')?.textContent).toContain('bad row');
  });

  it('shows a reconciliation badge per file', () => {
    flushLoad(
      [
        makeFile({ id: 1, reconciliationStatus: 'ok' }),
        makeFile({ id: 2, fileName: 'card.ofx', fileType: 'ofx', reconciliationStatus: 'mismatch', reconciliationDiff: 12.34 }),
      ],
      [],
    );
    const badges = Array.from(el.querySelectorAll('[data-testid="recon-badge"]')).map((b) => b.textContent?.trim());
    expect(badges[0]).toContain('Reconciled');
    expect(badges[1]).toContain('Off by $12.34');
  });

  it('shows rules applied / transfers matched in job progress', fakeAsync(() => {
    flushLoad([], [makeJob({ id: 5, status: 'running', rulesApplied: 4, transfersMatched: 2 })]);
    tick(0);
    http.expectOne('/api/jobs/5').flush(makeJob({ id: 5, status: 'running', rulesApplied: 4, transfersMatched: 2 }));
    fixture.detectChanges();
    const counts = el.querySelector('[data-testid="job-counts"]')!.textContent!;
    expect(counts).toContain('4 by rules');
    expect(counts).toContain('2 transfers matched');
    fixture.destroy();
  }));

  it('Process month starts a job and polls every second until completed, then refreshes months', fakeAsync(() => {
    flushLoad([], []);
    el.querySelector<HTMLButtonElement>('[data-testid="process-btn"]')!.click();
    const start = http.expectOne({ method: 'POST', url: '/api/jobs/process' });
    expect(start.request.body).toEqual({ month: '2024-01', mode: 'incremental' });
    start.flush(makeJob({ id: 9, status: 'queued' }));

    tick(0);
    http.expectOne('/api/jobs/9').flush(makeJob({ id: 9, status: 'running', processed: 3 }));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="job-status"]')?.textContent).toContain('Running');
    expect(el.querySelector<HTMLButtonElement>('[data-testid="process-btn"]')!.disabled).toBeTrue();

    tick(1000);
    http
      .expectOne('/api/jobs/9')
      .flush(makeJob({ id: 9, status: 'completed', inserted: 12, skippedDuplicates: 2, categorized: 10 }));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="job-counts"]')?.textContent).toContain('12 inserted');
    expect(el.querySelector('[data-testid="job-counts"]')?.textContent).toContain('2 duplicates skipped');
    expect(month.stub.refreshMonths).toHaveBeenCalled();
    http.expectOne('/api/categories').flush([]); // CategoryStore reload (transactionCount)
    http.expectOne((r) => r.url === '/api/statements').flush([]);
    http.expectOne((r) => r.url === '/api/jobs').flush([]);

    tick(5000);
    http.expectNone('/api/jobs/9'); // polling stopped
  }));

  it('stops polling when the job fails', fakeAsync(() => {
    flushLoad([], []);
    el.querySelector<HTMLButtonElement>('[data-testid="process-btn"]')!.click();
    http.expectOne('/api/jobs/process').flush(makeJob({ id: 4, status: 'queued' }));
    tick(0);
    http.expectOne('/api/jobs/4').flush(makeJob({ id: 4, status: 'failed', message: 'Ollama unreachable' }));
    fixture.detectChanges();
    expect(el.textContent).toContain('Ollama unreachable');
    http.expectOne('/api/categories').flush([]);
    http.expectOne((r) => r.url === '/api/statements').flush([]);
    http.expectOne((r) => r.url === '/api/jobs').flush([]);
    tick(3000);
    http.expectNone('/api/jobs/4');
  }));

  it('on 409 from Process month, re-lists jobs and tracks the active one', fakeAsync(() => {
    flushLoad([], []);
    el.querySelector<HTMLButtonElement>('[data-testid="process-btn"]')!.click();
    http
      .expectOne('/api/jobs/process')
      .flush({ statusCode: 409, message: 'A job is already running' }, { status: 409, statusText: 'Conflict' });
    http
      .expectOne((r) => r.url === '/api/jobs' && r.params.get('month') === '2024-01')
      .flush([makeJob({ id: 11, status: 'running', total: 10, processed: 4 }), makeJob({ id: 2, status: 'completed' })]);
    tick(0);
    http.expectOne('/api/jobs/11').flush(makeJob({ id: 11, status: 'running', total: 10, processed: 5 }));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="job-status"]')?.textContent).toContain('Running');
    expect(el.querySelector<HTMLButtonElement>('[data-testid="process-btn"]')!.disabled).toBeTrue();
    expect(el.querySelector<HTMLButtonElement>('[data-testid="recategorize-btn"]')!.disabled).toBeTrue();
    fixture.destroy();
    tick(3000);
  }));

  it('shows an indeterminate bar while queued or when processed has reached total', fakeAsync(() => {
    flushLoad([], [makeJob({ id: 12, status: 'queued', total: 5, processed: 0 })]);
    tick(0);
    http.expectOne('/api/jobs/12').flush(makeJob({ id: 12, status: 'running', total: 5, processed: 5 }));
    fixture.detectChanges();
    expect(el.querySelector('mat-progress-bar')?.getAttribute('mode')).toBe('indeterminate');
    fixture.destroy();
    tick(3000);
  }));

  it('resumes polling a job that is already running for the month, and stops on destroy', fakeAsync(() => {
    flushLoad([], [makeJob({ id: 7, status: 'running' })]);
    tick(0);
    http.expectOne('/api/jobs/7').flush(makeJob({ id: 7, status: 'running' }));
    fixture.destroy();
    tick(3000);
    http.expectNone('/api/jobs/7');
  }));

  it('Re-categorize asks for confirmation that mentions manual corrections, then posts recategorize', () => {
    flushLoad([], []);
    el.querySelector<HTMLButtonElement>('[data-testid="recategorize-btn"]')!.click();
    expect(dialog.open).toHaveBeenCalled();
    expect(dialog.open.calls.mostRecent().args[1].data).toBe(RECATEGORIZE_CONFIRM);
    expect(RECATEGORIZE_CONFIRM.message).toContain('manual corrections');
    expect(RECATEGORIZE_CONFIRM.message).toContain('split');
    const req = http.expectOne('/api/jobs/process');
    expect(req.request.body).toEqual({ month: '2024-01', mode: 'recategorize' });
    req.flush(makeJob({ id: 1, status: 'completed' }));
  });

  it('uploads files: named ones without month, others into the selected month', () => {
    flushLoad([], []);
    fixture.componentInstance.upload([
      new File(['a'], 'Main_Checking_2024-02.pdf'),
      new File(['b'], 'export.csv'),
      new File(['c'], 'notes.docx'),
    ]);
    const reqs = http.match('/api/statements/upload');
    expect(reqs.length).toBe(2);
    expect((reqs[0].request.body as FormData).has('month')).toBeFalse();
    expect((reqs[1].request.body as FormData).get('month')).toBe('2024-01');
    reqs[0].flush([makeFile({ month: '2024-02' })]);
    reqs[1].flush([makeFile({ fileName: 'export.csv' })]);
    expect(month.stub.refreshMonths).toHaveBeenCalled();
    http.expectOne((r) => r.url === '/api/statements').flush([]);
    http.expectOne((r) => r.url === '/api/jobs').flush([]);
  });
});

describe('partitionFiles', () => {
  it('accepts pdf/txt/csv/ofx/qfx up to 20MB, rejects others', () => {
    const big = new File(['x'], 'big.pdf');
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 });
    const r = partitionFiles([
      new File(['x'], 'a.PDF'),
      new File(['x'], 'b.txt'),
      new File(['x'], 'c.csv'),
      new File(['x'], 'e.ofx'),
      new File(['x'], 'f.QFX'),
      new File(['x'], 'd.xlsx'),
      big,
    ]);
    expect(r.accepted.map((f) => f.name)).toEqual(['a.PDF', 'b.txt', 'c.csv', 'e.ofx', 'f.QFX']);
    expect(r.rejected.map((f) => f.name)).toEqual(['d.xlsx', 'big.pdf']);
  });
});

describe('reconciliationBadge', () => {
  it('maps status to badge', () => {
    expect(reconciliationBadge(makeFile({ reconciliationStatus: 'ok' })).cls).toBe('ok');
    const mm = reconciliationBadge(makeFile({ reconciliationStatus: 'mismatch', reconciliationDiff: -42.5 }));
    expect(mm.cls).toBe('mismatch');
    expect(mm.label).toBe('Off by $42.50 — rows may be missing');
    expect(reconciliationBadge(makeFile({ reconciliationStatus: 'unknown' })).cls).toBe('unknown');
    expect(reconciliationBadge(makeFile()).cls).toBe('unknown'); // older payload without the field
  });

  it('labels OFX parse method and icon', () => {
    expect(parseMethodLabel('ofx')).toBe('Parsed (OFX)');
    expect(fileIcon('qfx')).toBe('account_balance');
  });
});

describe('MONTH_IN_NAME', () => {
  it('matches YYYY-MM not followed by another digit (mirrors the server)', () => {
    expect(MONTH_IN_NAME.test('Main_Checking_2024-01.pdf')).toBeTrue();
    expect(MONTH_IN_NAME.test('export-2024-12.csv')).toBeTrue();
    expect(MONTH_IN_NAME.test('ref_2024-011.csv')).toBeFalse();
    expect(MONTH_IN_NAME.test('card_2024-123.ofx')).toBeFalse();
    expect(MONTH_IN_NAME.test('card_2024-13.ofx')).toBeFalse();
  });
});
