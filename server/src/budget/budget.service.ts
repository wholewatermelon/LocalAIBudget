import { Injectable } from '@nestjs/common';
import { CategoryAccessService } from '../categories/category-access.service';
import { addMonths, monthRange } from '../common/month';
import { DbService, num } from '../db/db.service';
import {
  BudgetCategoryInfo,
  BudgetSummary,
  CategoryFlow,
  computeBudgetSummary,
} from './budget-math';

export interface TrendPoint {
  month: string;
  totalIncome: number;
  totalSpent: number;
  byCategory: Record<string, number>;
}

/**
 * Category-scoped reads (summary, trend). Months are by transaction_date. Splits contribute per split.
 * Visibility goes through CategoryAccessService.
 */
@Injectable()
export class BudgetService {
  constructor(
    private readonly db: DbService,
    private readonly access: CategoryAccessService,
  ) {}

  private async categories(): Promise<BudgetCategoryInfo[]> {
    const rows = await this.db.query(
      'SELECT id, name, budget_limit, is_income, is_transfer FROM categories ORDER BY name',
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      budgetLimit: num(r.budget_limit),
      isIncome: !!r.is_income,
      isTransfer: !!r.is_transfer,
    }));
  }

  /** Flows per (month, category) for months in [fromMonth, toMonth]. */
  private async flows(
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

  async summary(month: string): Promise<BudgetSummary> {
    const [cats, flows, visible] = await Promise.all([
      this.categories(),
      this.flows(month, month),
      this.access.visibleCategoryIds(),
    ]);
    return computeBudgetSummary(month, cats, flows.get(month) ?? [], visible);
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
    const [cats, flows, visible] = await Promise.all([
      this.categories(),
      this.flows(start, end),
      this.access.visibleCategoryIds(),
    ]);
    const out: TrendPoint[] = [];
    for (let i = 0; i < months; i++) {
      const m = addMonths(start, i);
      const s = computeBudgetSummary(m, cats, flows.get(m) ?? [], visible);
      const byCategory: Record<string, number> = {};
      for (const c of s.categories)
        if (!c.isIncome && !c.isTransfer && c.spent > 0)
          byCategory[c.name] = c.spent;
      out.push({
        month: m,
        totalIncome: s.totalIncome,
        totalSpent: s.totalSpent,
        byCategory,
      });
    }
    return out;
  }
}
