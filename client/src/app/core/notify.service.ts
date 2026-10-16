import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { PromptSnackbar, PromptSnackbarData } from '../shared/prompt-snackbar';
import { errorMessage } from './http-context';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly snack = inject(MatSnackBar);

  info(message: string, durationMs = 3000): void {
    this.snack.open(message, 'OK', { duration: durationMs });
  }

  /** Snackbar with an action button; emits (then completes) only if the action is clicked. */
  action(message: string, actionLabel: string, durationMs = 10000): Observable<void> {
    return this.snack.open(message, actionLabel, { duration: durationMs }).onAction();
  }

  /**
   * Persistent question: stays until the user clicks the action or "Not now"/×.
   * Emits (then completes) only if the action is clicked.
   */
  prompt(message: string, actionLabel: string, dismissLabel = 'Not now'): Observable<void> {
    return this.snack
      .openFromComponent<PromptSnackbar, PromptSnackbarData>(PromptSnackbar, {
        data: { message, actionLabel, dismissLabel },
      })
      .onAction();
  }

  error(messageOrError: unknown): void {
    const message = typeof messageOrError === 'string' ? messageOrError : errorMessage(messageOrError);
    this.snack.open(message, 'Dismiss', { duration: 6000, panelClass: 'error-snackbar' });
  }
}
