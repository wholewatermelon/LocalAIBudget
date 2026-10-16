import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, Subscription, of, switchMap } from 'rxjs';
import { BudgetPlanApi } from '../../core/api/budget-plan.api';
import { isNonSpendingCategory } from '../../core/category-utils';
import { CategoryStore } from '../../core/category.store';
import { errorMessage } from '../../core/http-context';
import { Month, MonthBudget, MonthBudgetItem } from '../../core/models';
import { formatMonth } from '../../core/month-utils';
import { NotifyService } from '../../core/notify.service';
import { MonthEditAction, monthEditAction, monthRowState, noteEditAction, parseAmount, previousMonth, unhideAction } from './budget-logic';

/** Sentinel value of the "add category" select meaning "create a new category". */
export const NEW_CATEGORY = -1;

@Component({
  selector: 'app-month-budget-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CurrencyPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './month-budget-tab.html',
  styleUrl: './budget-tables.scss',
})
export class MonthBudgetTab {
  private readonly api = inject(BudgetPlanApi);
  private readonly notify = inject(NotifyService);
  protected readonly categoryStore = inject(CategoryStore);

  readonly month = input.required<Month>();
  /** Emitted after any successful write (parent refreshes dependent data). */
  readonly changed = output<void>();

  protected readonly view = signal<MonthBudget | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal<ReadonlySet<number>>(new Set());
  protected readonly rowState = monthRowState;
  protected readonly prevLabel = computed(() => formatMonth(previousMonth(this.month())));
  protected readonly NEW_CATEGORY = NEW_CATEGORY;

  // "Add category for this month"
  protected readonly addCategoryId = signal<number | null>(null);
  protected readonly addNewName = signal('');
  protected readonly addAmount = signal<number | null>(null);
  protected readonly adding = signal(false);

  /** Spending categories not already listed this month. */
  protected readonly addable = computed(() => {
    const listed = new Set((this.view()?.items ?? []).map((i) => i.categoryId));
    return this.categoryStore.categories().filter((c) => !isNonSpendingCategory(c) && !listed.has(c.id));
  });
  protected readonly canAdd = computed(() => {
    const id = this.addCategoryId();
    const amount = parseAmount(this.addAmount());
    if (id === null || amount === null || amount === 'invalid' || this.adding()) return false;
    return id !== NEW_CATEGORY || !!this.addNewName().trim();
  });

  private sub?: Subscription;

  constructor() {
    this.categoryStore.ensureLoaded();
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe());
    effect(() => {
      const m = this.month();
      untracked(() => this.load(m));
    });
  }

  load(month: Month = this.month()): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.sub = this.api.month(month).subscribe({
      next: (v) => {
        this.view.set(v);
        this.loading.set(false);
      },
      error: () => {
        this.view.set(null);
        this.loading.set(false);
      },
    });
  }

  editAmount(item: MonthBudgetItem, raw: string): void {
    this.run(item, monthEditAction(item, raw));
  }

  editNote(item: MonthBudgetItem, note: string): void {
    this.run(item, noteEditAction(item, note));
  }

  reset(item: MonthBudgetItem): void {
    this.run(item, { kind: 'reset' });
  }

  hide(item: MonthBudgetItem): void {
    this.run(item, { kind: 'put', body: { hidden: true, ...(item.note ? { note: item.note } : {}) } });
  }

  unhide(item: MonthBudgetItem): void {
    this.run(item, unhideAction(item));
  }

  copyFromPrevious(): void {
    const month = this.month();
    const from = previousMonth(month);
    this.loading.set(true);
    this.api.copyAdjustments(month, from).subscribe({
      next: (v) => {
        this.loading.set(false);
        this.view.set(v);
        this.notify.info(`Copied adjustments from ${formatMonth(from)}`);
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.notify.error(err);
      },
    });
  }

  add(): void {
    if (!this.canAdd()) return;
    const month = this.month();
    const amount = parseAmount(this.addAmount()) as number;
    const id = this.addCategoryId()!;
    const categoryId$: Observable<number> =
      id === NEW_CATEGORY
        ? this.categoryStore.create({ name: this.addNewName().trim() }).pipe(switchMap((c) => of(c.id)))
        : of(id);
    this.adding.set(true);
    categoryId$.pipe(switchMap((cid) => this.api.setMonthItem(month, cid, { amount }))).subscribe({
      next: (v) => {
        this.adding.set(false);
        this.view.set(v);
        this.addCategoryId.set(null);
        this.addNewName.set('');
        this.addAmount.set(null);
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.adding.set(false);
        this.notify.error(errorMessage(err));
      },
    });
  }

  private run(item: MonthBudgetItem, action: MonthEditAction): void {
    if (action.kind === 'none') return;
    if (action.kind === 'invalid') {
      this.notify.error(action.message);
      this.load(); // restore the input value
      return;
    }
    const month = this.month();
    const req =
      action.kind === 'reset'
        ? this.api.resetMonthItem(month, item.categoryId)
        : this.api.setMonthItem(month, item.categoryId, action.body);
    this.busy.update((s) => new Set(s).add(item.categoryId));
    req.subscribe({
      next: (v) => {
        this.done(item.categoryId);
        this.view.set(v);
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.done(item.categoryId);
        this.notify.error(err);
        this.load();
      },
    });
  }

  private done(id: number): void {
    this.busy.update((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }
}
