import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SKIP_ERROR_SNACKBAR } from './http-context';
import { NotifyService } from './notify.service';

/** Shows every HTTP error in a snackbar unless the request opted out via `silent()`. Always rethrows. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notify = inject(NotifyService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && !req.context.get(SKIP_ERROR_SNACKBAR)) {
        notify.error(err);
      }
      return throwError(() => err);
    }),
  );
};
