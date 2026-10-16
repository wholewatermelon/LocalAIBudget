import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBarAction,
  MatSnackBarActions,
  MatSnackBarLabel,
  MatSnackBarRef,
} from '@angular/material/snack-bar';

export interface PromptSnackbarData {
  message: string;
  actionLabel: string;
  dismissLabel: string;
}

/** Snackbar with a primary action and an explicit "Not now"/close; stays open until one is clicked. */
@Component({
  selector: 'app-prompt-snackbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatSnackBarLabel, MatSnackBarActions, MatSnackBarAction],
  template: `
    <span matSnackBarLabel data-testid="prompt-message">{{ data.message }}</span>
    <span matSnackBarActions>
      <button mat-button matSnackBarAction (click)="ref.dismiss()" data-testid="prompt-dismiss">
        {{ data.dismissLabel }}
      </button>
      <button mat-button matSnackBarAction (click)="ref.dismissWithAction()" data-testid="prompt-action">
        {{ data.actionLabel }}
      </button>
      <button mat-icon-button matSnackBarAction (click)="ref.dismiss()" aria-label="Close" data-testid="prompt-close">
        <mat-icon>close</mat-icon>
      </button>
    </span>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
    }
  `,
})
export class PromptSnackbar {
  protected readonly data = inject<PromptSnackbarData>(MAT_SNACK_BAR_DATA);
  protected readonly ref = inject<MatSnackBarRef<PromptSnackbar>>(MatSnackBarRef);
}
