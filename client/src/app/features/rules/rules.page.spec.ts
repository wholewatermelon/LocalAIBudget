import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { makeCategory, makeTx } from '../../../testing/fixtures';
import { Rule } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { PREVIEW_DEBOUNCE_MS, RulesPage, patternError } from './rules.page';

const rule = (over: Partial<Rule> = {}): Rule => ({
  id: 1,
  pattern: 'NETFLIX',
  matchType: 'starts_with',
  categoryId: 5,
  categoryName: 'Entertainment',
  priority: 0,
  hits: 3,
  ...over,
});

describe('RulesPage', () => {
  let fixture: ComponentFixture<RulesPage>;
  let page: RulesPage;
  let http: HttpTestingController;
  let notify: jasmine.SpyObj<NotifyService>;
  let el: HTMLElement;

  beforeEach(() => {
    notify = jasmine.createSpyObj<NotifyService>('NotifyService', ['info', 'error', 'action']);
    TestBed.configureTestingModule({
      imports: [RulesPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotifyService, useValue: notify },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(true) }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RulesPage);
    page = fixture.componentInstance;
    el = fixture.nativeElement;
  });
  afterEach(() => http.verify());

  function init(rules = [rule()]) {
    fixture.detectChanges();
    http.expectOne('/api/categories').flush([makeCategory({ id: 4, name: 'Shopping' }), makeCategory({ id: 5, name: 'Entertainment' })]);
    http.expectOne('/api/rules').flush(rules);
    fixture.detectChanges();
  }

  it('lists rules', fakeAsync(() => {
    init([rule(), rule({ id: 2, pattern: 'AMZN MKTP', matchType: 'contains', categoryId: 4 })]);
    expect(el.querySelectorAll('[data-testid="rule-row"]').length).toBe(2);
    tick(PREVIEW_DEBOUNCE_MS);
  }));

  it('shows an empty state with no rules', fakeAsync(() => {
    init([]);
    expect(el.textContent).toContain('No rules yet');
    tick(PREVIEW_DEBOUNCE_MS);
  }));

  it('debounces the live preview and renders match count + sample', fakeAsync(() => {
    init();
    page['pattern'].set('AM');
    fixture.detectChanges();
    tick(100);
    page['pattern'].set('AMZN');
    fixture.detectChanges();
    tick(PREVIEW_DEBOUNCE_MS - 1);
    http.expectNone('/api/rules/preview');
    tick(1);
    const req = http.expectOne('/api/rules/preview');
    expect(req.request.body).toEqual({ pattern: 'AMZN', matchType: 'contains' });
    req.flush({ matchCount: 12, sample: [makeTx({ id: 1, description: 'AMZN Mktp US*2K4L91' })] });
    fixture.detectChanges();
    const preview = el.querySelector('[data-testid="rule-preview"]')!;
    expect(preview.textContent).toContain('12 matching transactions');
    expect(preview.textContent).toContain('AMZN Mktp US*2K4L91');
  }));

  it('does not preview an invalid regex', fakeAsync(() => {
    init();
    page['matchType'].set('regex');
    page['pattern'].set('AMZN(');
    fixture.detectChanges();
    tick(PREVIEW_DEBOUNCE_MS);
    http.expectNone('/api/rules/preview');
    fixture.detectChanges();
    expect(el.textContent).toContain('Invalid regular expression');
  }));

  it('creates a rule applied to existing transactions', fakeAsync(() => {
    init();
    page['pattern'].set('AMZN MKTP');
    page['categoryId'].set(4);
    fixture.detectChanges();
    tick(PREVIEW_DEBOUNCE_MS);
    http.expectOne('/api/rules/preview').flush({ matchCount: 2, sample: [] });
    page.create();
    const req = http.expectOne({ method: 'POST', url: '/api/rules' });
    expect(req.request.body).toEqual({ pattern: 'AMZN MKTP', matchType: 'contains', categoryId: 4, priority: 0, applyToExisting: true });
    req.flush(rule({ id: 9, pattern: 'AMZN MKTP', appliedCount: 12 }));
    expect(page['rules']().length).toBe(2);
    expect(notify.info).toHaveBeenCalledWith('Rule created — 12 transactions updated');
    fixture.detectChanges();
    tick(PREVIEW_DEBOUNCE_MS);
    http.expectNone('/api/rules/preview'); // cleared pattern -> no preview
  }));

  it('explains a duplicate rule (409)', fakeAsync(() => {
    init();
    page['pattern'].set('NETFLIX');
    page['categoryId'].set(5);
    page.create();
    http.expectOne({ method: 'POST', url: '/api/rules' }).flush({}, { status: 409, statusText: 'Conflict' });
    expect(notify.error.calls.mostRecent().args[0]).toContain('already exists');
    tick(PREVIEW_DEBOUNCE_MS);
    http.match('/api/rules/preview').forEach((r) => r.flush({ matchCount: 0, sample: [] }));
  }));

  it('edits and deletes rules inline', fakeAsync(() => {
    init();
    const r = page['rules']()[0];
    page.save(r, { categoryId: 4 });
    const patch = http.expectOne({ method: 'PATCH', url: '/api/rules/1' });
    expect(patch.request.body).toEqual({ categoryId: 4 });
    patch.flush(rule({ categoryId: 4, categoryName: 'Shopping' }));
    expect(page['rules']()[0].categoryName).toBe('Shopping');

    page.save(page['rules']()[0], { priority: 0 }); // unchanged -> no request
    page.remove(page['rules']()[0]);
    http.expectOne({ method: 'DELETE', url: '/api/rules/1' }).flush(null, { status: 204, statusText: 'No Content' });
    expect(page['rules']().length).toBe(0);
    tick(PREVIEW_DEBOUNCE_MS);
  }));
});

describe('patternError', () => {
  it('validates patterns', () => {
    expect(patternError('', 'contains')).toBe('Enter a pattern');
    expect(patternError('AMZN', 'contains')).toBeNull();
    expect(patternError('^SQ \\*', 'regex')).toBeNull();
    expect(patternError('(', 'regex')).toBe('Invalid regular expression');
  });
});
