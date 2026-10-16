import { round2 } from '../common/month';

export interface BudgetCategoryInfo {
  id: number;
  name: string;
  budgetLimit: number;
  isIncome: boolean;
  isTransfer: boolean;
}

/** Per-category sums of positive and negative amounts (splits already expanded; categoryId null = uncategorized). */
export interface CategoryFlow {
  categoryId: number | null;
  positive: number; // Σ amounts > 0
  negative: number; // Σ amounts < 0 (a negative number)
}

export interface BudgetCategoryLine {
  categoryId: number;
  name: string;
  budgetLimit: number;
  spent: number;
  remaining: number;
  /** 0–100 scale, 1 decimal; null when no limit is set. */
  percentUsed: number | null;
  isIncome: boolean;
  isTransfer: boolean;
}

export interface BudgetSummary {
  month: string;
  totalIncome: number;
  totalSpent: number;
  net: number;
  categories: BudgetCategoryLine[];
  uncategorizedSpent: number;
}

/**
 * Budget math (ARCHITECTURE.md "Budget"):
 * - spending category: spent = −Σ negative amounts; income category: spent = Σ positive amounts (reported positive).
 * - totals: totalIncome = Σ positive amounts, totalSpent = −Σ negative amounts, net = income − spent,
 *   all EXCLUDING transfer categories (card payments, moves between own accounts).
 * - order: spending categories (by spent desc), then income, then transfer categories (spent = money moved out),
 *   which are listed for information only and never count toward totals.
 * - `visible` (category allow-list, null = all) restricts everything, so hidden spending can't be inferred.
 */
const rank = (c: { isIncome: boolean; isTransfer: boolean }) =>
  c.isTransfer ? 2 : c.isIncome ? 1 : 0;

export function computeBudgetSummary(
  month: string,
  categories: BudgetCategoryInfo[],
  flows: CategoryFlow[],
  visible: number[] | null = null,
): BudgetSummary {
  const isVisible = (id: number | null) =>
    visible === null || (id !== null && visible.includes(id));
  const byId = new Map(categories.map((c) => [c.id, c]));
  const agg = new Map<number | null, { pos: number; neg: number }>();
  for (const f of flows) {
    if (!isVisible(f.categoryId)) continue;
    const cur = agg.get(f.categoryId) ?? { pos: 0, neg: 0 };
    cur.pos += f.positive;
    cur.neg += f.negative;
    agg.set(f.categoryId, cur);
  }
  let income = 0;
  let spent = 0;
  for (const [id, a] of agg) {
    if (id !== null && byId.get(id)?.isTransfer) continue;
    income += a.pos;
    spent += -a.neg;
  }
  const lines: BudgetCategoryLine[] = categories
    .filter((c) => isVisible(c.id))
    .map((c) => {
      const a = agg.get(c.id) ?? { pos: 0, neg: 0 };
      const s = round2(c.isIncome ? a.pos : -a.neg);
      return {
        categoryId: c.id,
        name: c.name,
        budgetLimit: round2(c.budgetLimit),
        spent: s,
        remaining: round2(c.budgetLimit - s),
        percentUsed:
          c.budgetLimit > 0
            ? Math.round((s / c.budgetLimit) * 1000) / 10
            : null,
        isIncome: c.isIncome,
        isTransfer: c.isTransfer,
      };
    })
    .sort(
      (a, b) =>
        rank(a) - rank(b) || b.spent - a.spent || a.name.localeCompare(b.name),
    );
  const unc = agg.get(null);
  return {
    month,
    totalIncome: round2(income),
    totalSpent: round2(spent),
    net: round2(income - spent),
    categories: lines,
    uncategorizedSpent: round2(unc ? -unc.neg : 0),
  };
}
