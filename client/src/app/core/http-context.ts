import { HttpContext, HttpContextToken, HttpErrorResponse } from '@angular/common/http';

/**
 * When set on a request, the global error interceptor will NOT show a snackbar.
 * Use it when the caller shows its own, more specific error (e.g. 409 on category delete,
 * optimistic-update rollback, background health polling).
 */
export const SKIP_ERROR_SNACKBAR = new HttpContextToken<boolean>(() => false);

export function silent(): HttpContext {
  return new HttpContext().set(SKIP_ERROR_SNACKBAR, true);
}

/** Human-readable message from an HTTP error (Nest `{ statusCode, message, error }` or network failure). */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the server. Is the API running on port 3000?';
    const body = err.error as { message?: unknown } | string | null;
    if (body && typeof body === 'object') {
      const m = body.message;
      if (Array.isArray(m)) return m.join('; ');
      if (typeof m === 'string' && m) return m;
    }
    if (typeof body === 'string' && body && !body.trimStart().startsWith('<')) return body;
    return `Request failed (${err.status}${err.statusText ? ' ' + err.statusText : ''})`;
  }
  if (err && typeof err === 'object' && 'name' in err && (err as Error).name === 'TimeoutError') {
    return 'The request timed out.';
  }
  if (err instanceof Error) return err.message;
  return 'Unexpected error';
}
