import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { isTransfer } from '../../core/category-utils';
import { CategoryStore } from '../../core/category.store';
import { errorMessage } from '../../core/http-context';
import { Category, CategoryUpdate } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog';

/** Friendly text for category write errors (409 = duplicate name / in use). */
export function categoryErrorMessage(err: unknown, action: 'create' | 'update' | 'delete', name: string): string {
  if (err instanceof HttpErrorResponse && err.status === 409) {
    return action === 'delete'
      ? `"${name}" is still used by transactions or splits. Re-categorize those first, then delete it.`
      : `A category named "${name}" already exists.`;
  }
  return errorMessage(err);
}

@Component({
  selector: 'app-categories-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    RouterLink,
  ],
  templateUrl: './categories.page.html',
  styleUrl: './categories.page.scss',
})
export class CategoriesPage {
  protected readonly store = inject(CategoryStore);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);

  protected readonly newName = signal('');
  protected readonly newIncome = signal(false);
  protected readonly newTransfer = signal(false);
  protected readonly creating = signal(false);
  protected readonly isTransfer = isTransfer;

  constructor() {
    this.store.load();
  }

  add(): void {
    const name = this.newName().trim();
    if (!name) return;
    this.creating.set(true);
    this.store
      .create({
        name,
        isIncome: this.newIncome(),
        isTransfer: this.newTransfer(),
      })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.newName.set('');
          this.newIncome.set(false);
          this.newTransfer.set(false);
          this.notify.info(`Added ${name}`);
        },
        error: (err: unknown) => {
          this.creating.set(false);
          this.notify.error(categoryErrorMessage(err, 'create', name));
        },
      });
  }

  /** Save one field if it changed. Invalid input reverts by reloading the row from the store. */
  save(c: Category, change: CategoryUpdate): void {
    if (change.name !== undefined) {
      change.name = change.name.trim();
      if (!change.name || change.name === c.name) return;
    }
    if (change.isIncome !== undefined && change.isIncome === c.isIncome) return;
    if (change.isTransfer !== undefined && change.isTransfer === isTransfer(c)) return;
    this.store.update(c.id, change).subscribe({
      next: () => this.notify.info(`Saved ${change.name ?? c.name}`),
      error: (err: unknown) => {
        this.notify.error(categoryErrorMessage(err, 'update', change.name ?? c.name));
        this.store.load(); // restore server state in the inputs
      },
    });
  }

  remove(c: Category): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete "${c.name}"?`,
          message: 'This cannot be undone.',
          confirmText: 'Delete',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .pipe(filter((ok) => ok === true))
      .subscribe(() =>
        this.store.delete(c.id).subscribe({
          next: () => this.notify.info(`Deleted ${c.name}`),
          error: (err: unknown) => this.notify.error(categoryErrorMessage(err, 'delete', c.name)),
        }),
      );
  }
}
