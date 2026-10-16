import { CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EMPTY, catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap, tap } from 'rxjs';
import { AccountsApi } from '../../core/api/categories.api';
import { RulesApi } from '../../core/api/rules.api';
import { TransactionsApi } from '../../core/api/transactions.api';
import { CategoryStore } from '../../core/category.store';
import { Transaction, TransactionFilters } from '../../core/models';
import { MonthService } from '../../core/month.service';
import { formatMonth } from '../../core/month-utils';
import { NotifyService } from '../../core/notify.service';
import { SplitDialog, SplitDialogData } from './split-dialog';

export const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-transactions-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    FormsModule,
    MatTableModule,
    MatSortModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatCheckboxModule,
    MatChipsModule,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
  ],
  templateUrl: './transactions.page.html',
  styleUrl: './transactions.page.scss',
})
export class TransactionsPage implements AfterViewInit {
  private readonly api = inject(TransactionsApi);
  private readonly monthSvc = inject(MonthService);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);
  private readonly accountsApi = inject(AccountsApi);
  private readonly rulesApi = inject(RulesApi);
  protected readonly categoryStore = inject(CategoryStore);

  /** Bound from `?uncategorized=true` (e.g. dashboard warning link). */
  readonly uncategorized = input<string | undefined>();
  /** Bound from `?needsReview=true` (dashboard review link). */
  readonly needsReview = input<string | undefined>();

  protected readonly month = this.monthSvc.selected;
  protected readonly monthLabel = computed(() => formatMonth(this.month() ?? ''));
  protected readonly accounts = toSignal(this.accountsApi.list().pipe(catchError(() => of([]))), {
    initialValue: [],
  });
  protected readonly categories = this.categoryStore.categories;

  // Filters
  protected readonly accountId = signal<number | null>(null);
  protected readonly categoryId = signal<number | null>(null);
  protected readonly uncategorizedOnly = signal(false);
  protected readonly needsReviewOnly = signal(false);
  /** Bump to re-fetch with the same filters (e.g. after a rule re-categorized rows). */
  private readonly reloadTick = signal(0);
  protected readonly searchText = signal('');
  private readonly search = toSignal(
    toObservable(this.searchText).pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged()),
    { initialValue: '' },
  );

  private readonly filters = computed<TransactionFilters | null>(() => {
    const month = this.month();
    if (!month) return null;
    this.reloadTick();
    return {
      month,
      accountId: this.accountId(),
      categoryId: this.uncategorizedOnly() ? null : this.categoryId(),
      uncategorized: this.uncategorizedOnly(),
      search: this.search(),
      needsReview: this.needsReviewOnly(),
    };
  });

  protected readonly loading = signal(false);
  protected readonly rows = signal<Transaction[]>([]);
  protected readonly saving = signal<ReadonlySet<number>>(new Set());
  protected readonly dataSource = new MatTableDataSource<Transaction>([]);
  /** Row ids ticked for bulk "looks good". */
  protected readonly selected = signal<ReadonlySet<number>>(new Set());
  protected readonly needsReviewCount = computed(() => this.monthSvc.selectedSummary()?.needsReviewCount ?? 0);
  protected readonly reviewableSelected = computed(() =>
    this.rows().filter((r) => this.selected().has(r.id) && r.needsReview).map((r) => r.id),
  );
  protected readonly allReviewSelected = computed(() => {
    const ids = this.rows().filter((r) => r.needsReview).map((r) => r.id);
    return ids.length > 0 && ids.every((id) => this.selected().has(id));
  });
  protected readonly columns = ['select', 'date', 'description', 'account', 'amount', 'category', 'source', 'actions'];

  private readonly sort = viewChild(MatSort);

  constructor() {
    this.categoryStore.ensureLoaded();

    effect(() => {
      if (this.uncategorized() === 'true') this.uncategorizedOnly.set(true);
    });
    effect(() => {
      if (this.needsReview() === 'true') this.needsReviewOnly.set(true);
    });

    toObservable(this.filters)
      .pipe(
        switchMap((f) => {
          if (!f) return of(null);
          this.loading.set(true);
          return this.api.list(f).pipe(catchError(() => of([] as Transaction[])));
        }),
        tap(() => this.loading.set(false)),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        if (list) {
          this.rows.set(list);
          this.selected.set(new Set());
        }
      });

    effect(() => {
      this.dataSource.data = this.rows();
    });

    this.dataSource.sortingDataAccessor = (t, col) => {
      switch (col) {
        case 'date':
          return t.date;
        case 'amount':
          return t.amount;
        case 'account':
          return t.accountName ?? '';
        case 'category':
          return t.splits.length ? 'Split' : (t.categoryName ?? '');
        default:
          return t.description.toLowerCase();
      }
    };
  }

  ngAfterViewInit(): void {
    const sort = this.sort();
    if (sort) this.dataSource.sort = sort;
  }

  protected clearFilters(): void {
    this.accountId.set(null);
    this.categoryId.set(null);
    this.uncategorizedOnly.set(false);
    this.needsReviewOnly.set(false);
    this.searchText.set('');
  }

  protected readonly hasFilters = computed(
    () =>
      this.accountId() !== null ||
      this.categoryId() !== null ||
      this.uncategorizedOnly() ||
      this.needsReviewOnly() ||
      !!this.searchText(),
  );

  /** Optimistic update; rolls back and shows a snackbar if the PATCH fails. */
  changeCategory(tx: Transaction, categoryId: number | null): void {
    if (tx.categoryId === categoryId) return;
    const previous = tx;
    const optimistic: Transaction = {
      ...tx,
      categoryId,
      categoryName: categoryId === null ? null : (this.categoryStore.byId().get(categoryId)?.name ?? null),
      categorizedBy: categoryId === null ? null : 'manual',
      isManualCorrection: true,
      needsReview: false, // any correction clears the review flag
    };
    this.replaceRow(optimistic);
    this.saving.update((s) => new Set(s).add(tx.id));
    this.api.setCategory(tx.id, categoryId).subscribe({
      next: (updated) => {
        this.replaceRow(updated);
        this.doneSaving(tx.id);
        this.countsChanged(true);
        if (categoryId !== null) this.offerRule(updated, categoryId);
      },
      error: (err: unknown) => {
        this.replaceRow(previous);
        this.doneSaving(tx.id);
        this.notify.error(err);
      },
    });
  }

  /**
   * MVP-B: after a correction, ask the server for a merchant pattern and offer
   * "Always categorize X as Y? (N matching)". Accepting creates a rule applied to existing rows.
   */
  private offerRule(tx: Transaction, categoryId: number): void {
    const categoryName = this.categoryStore.byId().get(categoryId)?.name ?? tx.categoryName ?? 'this category';
    this.rulesApi
      .suggest(tx.id)
      .pipe(
        catchError(() => EMPTY),
        filter((s) => !!s?.pattern),
        switchMap((s) =>
          this.notify
            .action(
              `Always categorize ${s.pattern} as ${categoryName}? (${s.matchCount} matching)`,
              'Create rule',
            )
            .pipe(map(() => s)),
        ),
        switchMap((s) =>
          this.rulesApi.create({ pattern: s.pattern, matchType: s.matchType, categoryId, applyToExisting: true }),
        ),
      )
      .subscribe({
        next: (rule) => {
          const n = rule.appliedCount ?? 0;
          this.notify.info(`Rule created — ${n} transaction${n === 1 ? '' : 's'} updated`);
          this.reloadTick.update((t) => t + 1);
          this.countsChanged(true);
        },
        error: (err: unknown) => this.notify.error(err),
      });
  }

  /** MVP-E: per-row "looks good" (clears needs_review without changing the category). */
  markReviewed(tx: Transaction): void {
    this.replaceRow({ ...tx, needsReview: false });
    this.api.markReviewed(tx.id).subscribe({
      next: (updated) => {
        this.replaceRow(updated);
        this.countsChanged(false);
      },
      error: (err: unknown) => {
        this.replaceRow(tx);
        this.notify.error(err);
      },
    });
  }

  /** MVP-E: bulk "looks good" for the ticked rows that need review. */
  approveSelected(): void {
    const ids = this.reviewableSelected();
    if (!ids.length) return;
    this.api.bulkReview(ids).subscribe(({ updated }) => {
      const set = new Set(ids);
      this.rows.update((rows) => rows.map((r) => (set.has(r.id) ? { ...r, needsReview: false } : r)));
      this.selected.set(new Set());
      this.notify.info(`Marked ${updated} transaction${updated === 1 ? '' : 's'} as reviewed`);
      this.countsChanged(false);
    });
  }

  protected toggleSelected(id: number, on: boolean): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected toggleAllReview(on: boolean): void {
    this.selected.set(on ? new Set(this.rows().filter((r) => r.needsReview).map((r) => r.id)) : new Set());
  }

  openSplit(tx: Transaction): void {
    this.dialog
      .open<SplitDialog, SplitDialogData, Transaction>(SplitDialog, {
        data: { transaction: tx, categories: this.categories() },
        width: '600px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) {
          this.replaceRow(updated);
          this.notify.info(updated.splits.length ? 'Splits saved' : 'Splits removed');
          this.countsChanged(true);
        }
      });
  }

  protected splitTooltip(tx: Transaction): string {
    return tx.splits.map((s) => `${s.categoryName}: ${s.amount.toFixed(2)}`).join('\n');
  }

  /**
   * Server-side counts changed: refresh the month summaries (uncategorized / needs-review badges) and,
   * when categories were (re)assigned, the per-category transactionCount in CategoryStore.
   */
  private countsChanged(categoriesToo: boolean): void {
    this.monthSvc.refreshMonths();
    if (categoriesToo) this.categoryStore.load();
  }

  private replaceRow(tx: Transaction): void {
    this.rows.update((rows) => rows.map((r) => (r.id === tx.id ? tx : r)));
  }

  private doneSaving(id: number): void {
    this.saving.update((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }
}
