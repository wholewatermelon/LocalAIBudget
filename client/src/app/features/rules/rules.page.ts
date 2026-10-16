import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, of, switchMap, tap } from 'rxjs';
import { RulesApi } from '../../core/api/rules.api';
import { CategoryStore } from '../../core/category.store';
import { errorMessage } from '../../core/http-context';
import { MatchType, Rule, RulePreview, RuleUpdate } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog';

export const PREVIEW_DEBOUNCE_MS = 400;

export const MATCH_TYPES: { value: MatchType; label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'regex', label: 'Regex' },
];

/** Client-side check before asking the server; returns an error message or null. */
export function patternError(pattern: string, matchType: MatchType): string | null {
  if (!pattern.trim()) return 'Enter a pattern';
  if (matchType === 'regex') {
    try {
      new RegExp(pattern);
    } catch {
      return 'Invalid regular expression';
    }
  }
  return null;
}

export function ruleErrorMessage(err: unknown, pattern: string): string {
  if (err instanceof HttpErrorResponse && err.status === 409) {
    return `A rule for "${pattern}" with that match type already exists.`;
  }
  return errorMessage(err);
}

@Component({
  selector: 'app-rules-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CurrencyPipe,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
  ],
  templateUrl: './rules.page.html',
  styleUrl: './rules.page.scss',
})
export class RulesPage {
  private readonly api = inject(RulesApi);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);
  protected readonly categoryStore = inject(CategoryStore);

  protected readonly matchTypes = MATCH_TYPES;
  protected readonly rules = signal<Rule[]>([]);
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);

  // New-rule form
  protected readonly pattern = signal('');
  protected readonly matchType = signal<MatchType>('contains');
  protected readonly categoryId = signal<number | null>(null);
  protected readonly priority = signal(0);
  protected readonly applyToExisting = signal(true);
  protected readonly creating = signal(false);

  protected readonly formError = computed(() =>
    this.pattern() ? patternError(this.pattern(), this.matchType()) : null,
  );
  protected readonly canCreate = computed(
    () => !!this.pattern().trim() && !this.formError() && this.categoryId() !== null && !this.creating(),
  );

  // Live preview
  protected readonly preview = signal<RulePreview | null>(null);
  protected readonly previewing = signal(false);
  protected readonly previewError = signal<string | null>(null);

  constructor() {
    this.categoryStore.ensureLoaded();
    this.load();

    toObservable(computed(() => ({ pattern: this.pattern().trim(), matchType: this.matchType() })))
      .pipe(
        debounceTime(PREVIEW_DEBOUNCE_MS),
        distinctUntilChanged((a, b) => a.pattern === b.pattern && a.matchType === b.matchType),
        tap(() => {
          this.preview.set(null);
          this.previewError.set(null);
        }),
        filter(({ pattern, matchType }) => !!pattern && !patternError(pattern, matchType)),
        switchMap(({ pattern, matchType }) => {
          this.previewing.set(true);
          return this.api.preview(pattern, matchType).pipe(
            catchError((err: unknown) => {
              this.previewError.set(errorMessage(err));
              return of(null);
            }),
            finalize(() => this.previewing.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((p) => this.preview.set(p));
  }

  load(): void {
    this.loading.set(true);
    this.api
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => {
          this.rules.set(list);
          this.loaded.set(true);
        },
        error: () => this.loaded.set(true),
      });
  }

  create(): void {
    const pattern = this.pattern().trim();
    const categoryId = this.categoryId();
    if (!this.canCreate() || categoryId === null) return;
    this.creating.set(true);
    this.api
      .create({
        pattern,
        matchType: this.matchType(),
        categoryId,
        priority: this.priority(),
        applyToExisting: this.applyToExisting(),
      })
      .subscribe({
        next: (rule) => {
          this.creating.set(false);
          this.rules.update((list) => [rule, ...list]);
          this.pattern.set('');
          this.preview.set(null);
          const n = rule.appliedCount;
          this.notify.info(
            n != null ? `Rule created — ${n} transaction${n === 1 ? '' : 's'} updated` : 'Rule created',
          );
        },
        error: (err: unknown) => {
          this.creating.set(false);
          this.notify.error(ruleErrorMessage(err, pattern));
        },
      });
  }

  /** Inline edit: PATCH one field; on failure restore the server state. */
  save(rule: Rule, change: RuleUpdate): void {
    if (change.pattern !== undefined) {
      change.pattern = change.pattern.trim();
      if (change.pattern === rule.pattern) return;
      const err = patternError(change.pattern, change.matchType ?? rule.matchType);
      if (err) {
        this.notify.error(err);
        this.load();
        return;
      }
    }
    if (change.priority !== undefined) {
      const p = Math.trunc(Number(change.priority));
      if (!Number.isFinite(p) || p === rule.priority) return;
      change.priority = p;
    }
    this.api.update(rule.id, change).subscribe({
      next: (updated) => this.rules.update((list) => list.map((r) => (r.id === rule.id ? updated : r))),
      error: (err: unknown) => {
        this.notify.error(ruleErrorMessage(err, change.pattern ?? rule.pattern));
        this.load();
      },
    });
  }

  remove(rule: Rule): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete rule "${rule.pattern}"?`,
          message: 'Transactions it already categorized keep their category.',
          confirmText: 'Delete',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .pipe(filter((ok) => ok === true))
      .subscribe(() =>
        this.api.delete(rule.id).subscribe(() => {
          this.rules.update((list) => list.filter((r) => r.id !== rule.id));
          this.notify.info('Rule deleted');
        }),
      );
  }
}
