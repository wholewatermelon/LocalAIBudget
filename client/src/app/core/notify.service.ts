import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { errorMessage } from './http-context';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly snack = inject(MatSnackBar);

  info(message: string): void {
    this.snack.open(message, 'OK', { duration: 3000 });
  }

  /** Snackbar with an action button; emits (then completes) only if the action is clicked. */
  action(message: string, actionLabel: string, durationMs = 10000): Observable<void> {
    return this.snack.open(message, actionLabel, { duration: durationMs }).onAction();
  }

  error(messageOrError: unknown): void {
    const message = typeof messageOrError === 'string' ? messageOrError : errorMessage(messageOrError);
    this.snack.open(message, 'Dismiss', { duration: 6000, panelClass: 'error-snackbar' });
  }
}
