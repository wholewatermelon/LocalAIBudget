import { CurrencyPipe, DatePipe } from '@angular/common';
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
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, Subscription, filter, switchMap } from 'rxjs';
import { BudgetPlanApi } from '../../core/api/budget-plan.api';
import { isNonSpendingCategory } from '../../core/category-utils';
import { CategoryStore } from '../../core/category.store';
import { MainBudget, MainBudgetItem, MainBudgetVersion, Month } from '../../core/models';
import { formatMonth } from '../../core/month-utils';
import { NotifyService } from '../../core/notify.service';
import { ApplyStartingData, ApplyStartingDialog } from './apply-starting-dialog';
import { parseAmount } from './budget-logic';
import { SeedDialog, SeedDialogData } from './seed-dialog';

@Component({
  selector: 'app-main-budget-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './main-budget-tab.html',
  styleUrl: './budget-tables.scss',
})
export class MainBudgetTab {
  private readonly api = inject(BudgetPlanApi);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);
  protected readonly categoryStore = inject(CategoryStore);

  /** Main budget is shown "as of" this month; it is also the default "Apply starting" month. */
  readonly month = input.required<Month>();
  readonly changed = output<void>();

  protected readonly main = signal<MainBudget | null>(null);
  protected readonly loading = signal(false);
  protected readonly monthLabel = computed(() => formatMonth(this.month()));
  protected readonly fmtMonth = formatMonth;

  protected readonly openHistory = signal<number | null>(null);
  protected readonly history = signal<MainBudgetVersion[] | null>(null);

  protected readonly addCategoryId = signal<number | null>(null);
  protected readonly addAmount = signal<number | null>(null);

  protected readonly addable = computed(() => {
    const inMain = new Set((this.main()?.items ?? []).map((i) => i.categoryId));
    return this.categoryStore.categories().filter((c) => !isNonSpendingCategory(c) && !inMain.has(c.id));
  });
  protected readonly canAdd = computed(() => {
    const a = parseAmount(this.addAmount());
    return this.addCategoryId() !== null && a !== null && a !== 'invalid' && a > 0;
  });

  private sub?: Subscription;

  constructor() {
    this.categoryStore.ensureLoaded();
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe());
    effect(() => {
      const m = this.month();
      untracked(() => {
        this.openHistory.set(null);
        this.load(m);
      });
    });
  }

  load(month: Month = this.month()): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.sub = this.api.main(month).subscribe({
      next: (m) => {
        this.main.set(m);
        this.loading.set(false);
      },
      error: () => {
        this.main.set(null);
        this.loading.set(false);
      },
    });
  }

  edit(item: MainBudgetItem, raw: string): void {
    const amount = parseAmount(raw);
    if (amount === 'invalid' || amount === null || amount === 0) {
      this.notify.error('Enter a positive amount (use remove to take a category out of the main budget)');
      this.load();
      return;
    }
    if (amount === item.amount) return;
    this.write(item.categoryId, amount, `${item.categoryName}: ${money(item.amount)} → ${money(amount)}`);
  }

  remove(item: MainBudgetItem): void {
    this.write(item.categoryId, null, `Remove ${item.categoryName} from the main budget`);
  }

  add(): void {
    if (!this.canAdd()) return;
    const id = this.addCategoryId()!;
    const amount = parseAmount(this.addAmount()) as number;
    const name = this.categoryStore.byId().get(id)?.name ?? 'category';
    this.write(id, amount, `Add ${name}: ${money(amount)}`, () => {
      this.addCategoryId.set(null);
      this.addAmount.set(null);
    });
  }

  /** Ask "Apply starting:", then PUT the version. Cancelling restores the inputs. */
  private write(categoryId: number, amount: number | null, summary: string, onDone?: () => void): void {
    this.dialog
      .open<ApplyStartingDialog, ApplyStartingData, Month>(ApplyStartingDialog, {
        data: { summary, defaultMonth: this.month() },
      })
      .afterClosed()
      .pipe(
        filter((m): m is Month => {
          if (!m) this.load(); // cancelled: put the old value back in the input
          return !!m;
        }),
        switchMap((from) => this.api.setMainItem(categoryId, amount, from)),
      )
      .subscribe({
        next: () => {
          onDone?.();
          this.afterWrite(categoryId);
        },
        error: (err: unknown) => {
          this.notify.error(err);
          this.load();
        },
      });
  }

  toggleHistory(item: MainBudgetItem): void {
    if (this.openHistory() === item.categoryId) {
      this.openHistory.set(null);
      return;
    }
    this.openHistory.set(item.categoryId);
    this.loadHistory(item.categoryId);
  }

  undo(categoryId: number, v: MainBudgetVersion): void {
    this.api.deleteMainVersion(categoryId, v.effectiveFrom).subscribe({
      next: () => {
        this.notify.info(`Undid the change from ${formatMonth(v.effectiveFrom)}`);
        this.afterWrite(categoryId);
      },
      error: (err: unknown) => this.notify.error(err),
    });
  }

  openSeed(): void {
    this.dialog
      .open<SeedDialog, SeedDialogData, MainBudget>(SeedDialog, {
        data: { selectedMonth: this.month(), currentMain: this.main()?.items ?? [] },
        width: '720px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .pipe(filter((r): r is MainBudget => !!r))
      .subscribe((r) => {
        this.notify.info(`Main budget replaced starting ${formatMonth(r.month)}`);
        this.load();
        this.changed.emit();
      });
  }

  private afterWrite(categoryId: number): void {
    this.load();
    if (this.openHistory() === categoryId) this.loadHistory(categoryId);
    this.changed.emit();
  }

  private loadHistory(categoryId: number): void {
    this.history.set(null);
    const req: Observable<MainBudgetVersion[]> = this.api.history(categoryId);
    req.subscribe({ next: (h) => this.history.set(h), error: () => this.history.set([]) });
  }
}

function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
