import { Injectable } from '@nestjs/common';
import { CategoryAccessService } from '../categories/category-access.service';
import { addMonths, monthRange } from '../common/month';
import { DbService, num, numOrNull } from '../db/db.service';
import {
  BudgetCategoryInfo,
  BudgetSummary,
  CategoryFlow,
  computeBudgetSummary,
} from './budget-math';
import {
  effectiveBudgetMap,
  MainVersion,
  MonthAdjustment,
} from './budget-plan';

export interface TrendPoint {
  month: string;
  totalIncome: number;
  totalSpent: number;
  /** Σ effective budgets of the month (section H; additive field). */
  totalBudgeted: number;
  byCategory: Record<string, number>;
}

export interface CategoryRow {
  id: number;
  name: string;
  isIncome: boolean;
  isTransfer: boolean;
}

export const isBudgetable = (c: { isIncome: boolean; isTransfer: boolean }) =>
  !c.isIncome && !c.isTransfer;

/**
 * Category-scoped budget reads (summary, trend) plus the data loaders used by the main/month budget.
 * Months are by transaction_date; splits contribute per split. Visibility goes through CategoryAccessService.
 */
@Injectable()
export class BudgetService {
  constructor(
    private readonly db: DbService,
    private readonly access: CategoryAccessService,
  ) {}

  /** Categories visible to the viewer. */
  async categories(): Promise<CategoryRow[]> {
    const visible = await this.access.visibleCategoryIds();
    const rows = await this.db.query(
      `SELECT id, name, is_income, is_transfer FROM categories
       WHERE ($1::int[] IS NULL OR id = ANY($1)) ORDER BY name`,
      [visible],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      isIncome: !!r.is_income,
      isTransfer: !!r.is_transfer,
    }));
  }

  /** All main-budget versions (optionally for one category). */
  async mainVersions(
    categoryId?: number,
  ): Promise<(MainVersion & { createdAt: Date })[]> {
    const rows = await this.db.query(
      `SELECT category_id, effective_from, amount, created_at FROM budget_main_items
       WHERE ($1::int IS NULL OR category_id = $1) ORDER BY effective_from`,
      [categoryId ?? null],
    );
    return rows.map((r) => ({
      categoryId: r.category_id,
      effectiveFrom: r.effective_from,
      amount: numOrNull(r.amount),
      createdAt: r.created_at,
    }));
  }

  /** Adjustments for the given months. */
  async adjustments(months: string[]): Promise<Map<string, MonthAdjustment[]>> {
    const rows = await this.db.query(
      `SELECT month, category_id, amount, hidden, note FROM budget_month_items WHERE month = ANY($1::text[])`,
      [months],
    );
    const out = new Map<string, MonthAdjustment[]>();
    for (const r of rows) {
      const list = out.get(r.month) ?? [];
      list.push({
        categoryId: r.category_id,
        amount: numOrNull(r.amount),
        hidden: !!r.hidden,
        note: r.note ?? null,
      });
      out.set(r.month, list);
    }
    return out;
  }

  /** Flows per (month, category) for months in [fromMonth, toMonth]. */
  async flows(
    fromMonth: string,
    toMonth: string,
  ): Promise<Map<string, CategoryFlow[]>> {
    const rows = await this.db.query(
      `SELECT to_char(t.transaction_date, 'YYYY-MM') AS month, x.category_id,
         COALESCE(sum(x.amount) FILTER (WHERE x.amount > 0), 0) AS positive,
         COALESCE(sum(x.amount) FILTER (WHERE x.amount < 0), 0) AS negative
       FROM transactions t
       CROSS JOIN LATERAL (
         SELECT s.category_id, s.amount FROM transaction_splits s WHERE s.transaction_id = t.id
         UNION ALL
         SELECT t.category_id, t.amount
         WHERE NOT EXISTS (SELECT 1 FROM transaction_splits s2 WHERE s2.transaction_id = t.id)
       ) x
       WHERE t.transaction_date >= $1::date AND t.transaction_date < $2::date
       GROUP BY 1, 2`,
      [monthRange(fromMonth).start, monthRange(toMonth).end],
    );
    const out = new Map<string, CategoryFlow[]>();
    for (const r of rows) {
      const list = out.get(r.month) ?? [];
      list.push({
        categoryId: r.category_id,
        positive: num(r.positive),
        negative: num(r.negative),
      });
      out.set(r.month, list);
    }
    return out;
  }

  /** Spent (−Σ negative) per category per month; months with any transaction are listed in `monthsWithData`. */
  async spentByMonth(
    fromMonth: string,
    toMonth: string,
  ): Promise<{
    spent: Map<string, Map<number, number>>;
    monthsWithData: Set<string>;
  }> {
    const flows = await this.flows(fromMonth, toMonth);
    const spent = new Map<string, Map<number, number>>();
    for (const [m, list] of flows) {
      const byCat = new Map<number, number>();
      for (const f of list) {
        if (f.categoryId !== null && f.negative < 0) {
          byCat.set(f.categoryId, (byCat.get(f.categoryId) ?? 0) - f.negative);
        }
      }
      spent.set(m, byCat);
    }
    return { spent, monthsWithData: new Set(flows.keys()) };
  }

  /** Effective budget per category for each month in [fromMonth, toMonth]. */
  async effectiveBudgets(
    fromMonth: string,
    toMonth: string,
  ): Promise<Map<string, Map<number, number>>> {
    const months: string[] = [];
    for (let m = fromMonth; m <= toMonth; m = addMonths(m, 1)) months.push(m);
    const [versions, adjustments] = await Promise.all([
      this.mainVersions(),
      this.adjustments(months),
    ]);
    return new Map(
      months.map((m) => [
        m,
        effectiveBudgetMap(m, versions, adjustments.get(m) ?? []),
      ]),
    );
  }

  private withBudgets(
    cats: CategoryRow[],
    budgets: Map<number, number>,
  ): BudgetCategoryInfo[] {
    return cats.map((c) => ({
      ...c,
      budgetLimit: isBudgetable(c) ? (budgets.get(c.id) ?? null) : null,
    }));
  }

  async summary(month: string): Promise<BudgetSummary> {
    const [cats, flows, budgets, visible] = await Promise.all([
      this.categories(),
      this.flows(month, month),
      this.effectiveBudgets(month, month),
      this.access.visibleCategoryIds(),
    ]);
    return computeBudgetSummary(
      month,
      this.withBudgets(cats, budgets.get(month) ?? new Map()),
      flows.get(month) ?? [],
      visible,
    );
  }

  /** Latest month with transactions (by date), or the current month. */
  async latestMonth(): Promise<string> {
    const r = await this.db.one(
      `SELECT to_char(max(transaction_date), 'YYYY-MM') AS m FROM transactions`,
    );
    return (r?.m as string | null) ?? new Date().toISOString().slice(0, 7);
  }

  /** `months` calendar months ending at `endMonth` (default: latest month with data), oldest first. */
  async trend(months: number, endMonth?: string): Promise<TrendPoint[]> {
    const end = endMonth ?? (await this.latestMonth());
    const start = addMonths(end, -(months - 1));
    const [cats, flows, budgets, visible] = await Promise.all([
      this.categories(),
      this.flows(start, end),
      this.effectiveBudgets(start, end),
      this.access.visibleCategoryIds(),
    ]);
    const out: TrendPoint[] = [];
    for (let i = 0; i < months; i++) {
      const m = addMonths(start, i);
      const s = computeBudgetSummary(
        m,
        this.withBudgets(cats, budgets.get(m) ?? new Map()),
        flows.get(m) ?? [],
        visible,
      );
      const byCategory: Record<string, number> = {};
      let totalBudgeted = 0;
      for (const c of s.categories) {
        if (!c.isIncome && !c.isTransfer && c.spent > 0)
          byCategory[c.name] = c.spent;
        totalBudgeted += c.budgetLimit ?? 0;
      }
      out.push({
        month: m,
        totalIncome: s.totalIncome,
        totalSpent: s.totalSpent,
        totalBudgeted: Math.round(totalBudgeted * 100) / 100,
        byCategory,
      });
    }
    return out;
  }
}
