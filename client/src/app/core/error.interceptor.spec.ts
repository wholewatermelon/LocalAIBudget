import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { errorInterceptor } from './error.interceptor';
import { errorMessage, silent } from './http-context';
import { NotifyService } from './notify.service';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let notify: jasmine.SpyObj<NotifyService>;

  beforeEach(() => {
    notify = jasmine.createSpyObj<NotifyService>('NotifyService', ['error', 'info']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotifyService, useValue: notify },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctrl.verify());

  it('shows a snackbar and rethrows', () => {
    let caught: unknown;
    http.get('/api/x').subscribe({ error: (e) => (caught = e) });
    ctrl.expectOne('/api/x').flush({ statusCode: 400, message: 'bad month' }, { status: 400, statusText: 'Bad Request' });
    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(caught instanceof HttpErrorResponse).toBeTrue();
  });

  it('stays quiet for silent() requests', () => {
    http.get('/api/x', { context: silent() }).subscribe({ error: () => undefined });
    ctrl.expectOne('/api/x').flush({}, { status: 409, statusText: 'Conflict' });
    expect(notify.error).not.toHaveBeenCalled();
  });
});

describe('errorMessage', () => {
  const mk = (status: number, error: unknown) => new HttpErrorResponse({ status, error, statusText: 'X' });

  it('uses Nest message string or joins arrays', () => {
    expect(errorMessage(mk(400, { message: 'month must be YYYY-MM' }))).toBe('month must be YYYY-MM');
    expect(errorMessage(mk(400, { message: ['a', 'b'] }))).toBe('a; b');
  });

  it('explains network failures', () => {
    expect(errorMessage(mk(0, null))).toContain('Cannot reach the server');
  });

  it('falls back to status, ignores HTML bodies', () => {
    expect(errorMessage(mk(502, '<html>bad gateway</html>'))).toBe('Request failed (502 X)');
  });

  it('handles timeouts and plain errors', () => {
    const t = new Error('x');
    t.name = 'TimeoutError';
    expect(errorMessage(t)).toBe('The request timed out.');
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });
});
