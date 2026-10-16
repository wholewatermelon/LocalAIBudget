import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addMonths, round2 } from '../common/month';
import { DbService } from '../db/db.service';
import {
  averageSpent,
  buildSeedProposal,
  BudgetSource,
  mainAsOf,
  resolveEffective,
  RoundTo,
  seedWrites,
} from './budget-plan';
import { BudgetService, CategoryRow, isBudgetable } from './budget.service';

export interface MainBudgetItem {
  categoryId: number;
  categoryName: string;
  amount: number;
  effectiveFrom: string;
  hasLaterChange: boolean;
}

export interface MainBudget {
  month: string;
  items: MainBudgetItem[];
  total: number;
}

export interface MainHistoryEntry {
  effectiveFrom: string;
  amount: number | null;
  createdAt: string;
}

export interface SeedRequest {
  fromMonth: string;
  source: 'actual' | 'budget' | 'average';
  averageMonths?: number;
  roundTo?: RoundTo;
  effectiveFrom: string;
}

export interface SeedPreview {
  items: {
    categoryId: number;
    categoryName: string;
    amount: number;
    currentMainAmount: number | null;
  }[];
  total: number;
}

export interface MonthBudgetItem {
  categoryId: number;
  categoryName: string;
  mainAmount: number | null;
  adjustedAmount: number | null;
  hidden: boolean;
  note: string | null;
  effectiveAmount: number | null;
  source: BudgetSource;
  spent: number;
  remaining: number | null;
}

export interface MonthBudget {
  month: string;
  totalBudgeted: number;
  totalSpent: number;
  items: MonthBudgetItem[];
}

/** Main budget (versioned) + month adjustments — ARCHITECTURE.md section H. Reads use BudgetService (visibility-aware). */
@Injectable()
export class BudgetPlanService {
  constructor(
    private readonly db: DbService,
    private readonly budget: BudgetService,
  ) {}

  /** Visible category or 404; must be a spending category or 400. */
  private async budgetableCategory(categoryId: number): Promise<CategoryRow> {
    const cat = (await this.budget.categories()).find(
      (c) => c.id === categoryId,
    );
    if (!cat) throw new NotFoundException(`Category ${categoryId} not found`);
    if (!isBudgetable(cat)) {
      throw new BadRequestException(
        `Category "${cat.name}" is an income/transfer category and cannot be budgeted`,
      );
    }
    return cat;
  }

  // ---- main budget ------------------------------------------------------------------------------

  async main(month: string): Promise<MainBudget> {
    const [cats, versions] = await Promise.all([
      this.budget.categories(),
      this.budget.mainVersions(),
    ]);
    const main = mainAsOf(month, versions);
    const items: MainBudgetItem[] = cats
      .filter((c) => main.has(c.id))
      .map((c) => {
        const m = main.get(c.id)!;
        return {
          categoryId: c.id,
          categoryName: c.name,
          amount: m.amount,
          effectiveFrom: m.effectiveFrom,
          hasLaterChange: m.hasLaterChange,
        };
      });
    return {
      month,
      items,
      total: round2(items.reduce((s, i) => s + i.amount, 0)),
    };
  }

  async history(categoryId: number): Promise<MainHistoryEntry[]> {
    const cat = (await this.budget.categories()).find(
      (c) => c.id === categoryId,
    );
    if (!cat) throw new NotFoundException(`Category ${categoryId} not found`);
    return (await this.budget.mainVersions(categoryId)).map((v) => ({
      effectiveFrom: v.effectiveFrom,
      amount: v.amount,
      createdAt:
        v.createdAt instanceof Date
          ? v.createdAt.toISOString()
          : String(v.createdAt),
    }));
  }

  async putMainItem(
    categoryId: number,
    amount: number | null,
    effectiveFrom: string,
  ): Promise<MainBudget> {
    await this.budgetableCategory(categoryId);
    await this.db.query(
      `INSERT INTO budget_main_items (category_id, effective_from, amount) VALUES ($1, $2, $3)
       ON CONFLICT (category_id, effective_from) DO UPDATE SET amount = EXCLUDED.amount, created_at = now()`,
      [categoryId, effectiveFrom, amount],
    );
    return this.main(effectiveFrom);
  }

  async deleteMainVersion(
    categoryId: number,
    effectiveFrom: string,
  ): Promise<void> {
    const rows = await this.db.query(
      'DELETE FROM budget_main_items WHERE category_id = $1 AND effective_from = $2 RETURNING id',
      [categoryId, effectiveFrom],
    );
    if (!rows.length) {
      throw new NotFoundException(
        `No main budget version for category ${categoryId} from ${effectiveFrom}`,
      );
    }
  }

  async seedPreview(req: SeedRequest): Promise<SeedPreview> {
    const [cats, versions] = await Promise.all([
      this.budget.categories(),
      this.budget.mainVersions(),
    ]);
    const budgetable = new Set(cats.filter(isBudgetable).map((c) => c.id));
    const raw = await this.seedSource(req);
    const proposal = buildSeedProposal(raw, budgetable, req.roundTo ?? 25);
    const current = mainAsOf(req.effectiveFrom, versions);
    const names = new Map(cats.map((c) => [c.id, c.name]));
    const items = proposal
      .map((p) => ({
        categoryId: p.categoryId,
        categoryName: names.get(p.categoryId)!,
        amount: p.amount,
        currentMainAmount: current.get(p.categoryId)?.amount ?? null,
      }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    return { items, total: round2(items.reduce((s, i) => s + i.amount, 0)) };
  }

  async seed(req: SeedRequest): Promise<MainBudget> {
    const preview = await this.seedPreview(req);
    const [cats, versions] = await Promise.all([
      this.budget.categories(),
      this.budget.mainVersions(),
    ]);
    const visible = new Set(cats.map((c) => c.id));
    const current = mainAsOf(req.effectiveFrom, versions);
    // Only tombstone categories the viewer can see.
    for (const id of [...current.keys()])
      if (!visible.has(id)) current.delete(id);
    const writes = seedWrites(preview.items, current);
    await this.db.tx(async (c) => {
      for (const w of writes) {
        await c.query(
          `INSERT INTO budget_main_items (category_id, effective_from, amount) VALUES ($1, $2, $3)
           ON CONFLICT (category_id, effective_from) DO UPDATE SET amount = EXCLUDED.amount, created_at = now()`,
          [w.categoryId, req.effectiveFrom, w.amount],
        );
      }
    });
    return this.main(req.effectiveFrom);
  }

  /** Raw (unrounded) amounts per category for a seed source. */
  private async seedSource(req: SeedRequest): Promise<Map<number, number>> {
    if (req.source === 'budget') {
      return (
        (await this.budget.effectiveBudgets(req.fromMonth, req.fromMonth)).get(
          req.fromMonth,
        ) ?? new Map()
      );
    }
    const n = req.source === 'average' ? (req.averageMonths ?? 3) : 1;
    const start = addMonths(req.fromMonth, -(n - 1));
    const { spent, monthsWithData } = await this.budget.spentByMonth(
      start,
      req.fromMonth,
    );
    const months: string[] = [];
    for (let m = start; m <= req.fromMonth; m = addMonths(m, 1)) months.push(m);
    return averageSpent(monthsWithData, spent, months);
  }

  // ---- month view ---------------------------------------------------------------------------------

  async month(month: string): Promise<MonthBudget> {
    const [cats, versions, adjustments, spentData] = await Promise.all([
      this.budget.categories(),
      this.budget.mainVersions(),
      this.budget.adjustments([month]),
      this.budget.spentByMonth(month, month),
    ]);
    const main = mainAsOf(month, versions);
    const adj = new Map(
      (adjustments.get(month) ?? []).map((a) => [a.categoryId, a]),
    );
    const spent = spentData.spent.get(month) ?? new Map<number, number>();
    const items: MonthBudgetItem[] = [];
    for (const c of cats.filter(isBudgetable)) {
      const s = round2(spent.get(c.id) ?? 0);
      if (!main.has(c.id) && !adj.has(c.id) && s <= 0) continue;
      const e = resolveEffective(c.id, main, adj.get(c.id));
      items.push({
        categoryId: c.id,
        categoryName: c.name,
        mainAmount: e.mainAmount,
        adjustedAmount: e.adjustedAmount,
        hidden: e.hidden,
        note: e.note,
        effectiveAmount: e.effectiveAmount,
        source: e.source,
        spent: s,
        remaining:
          e.effectiveAmount === null ? null : round2(e.effectiveAmount - s),
      });
    }
    return {
      month,
      totalBudgeted: round2(
        items.reduce((t, i) => t + (i.effectiveAmount ?? 0), 0),
      ),
      totalSpent: round2(items.reduce((t, i) => t + i.spent, 0)),
      items,
    };
  }

  async putMonthItem(
    month: string,
    categoryId: number,
    dto: { amount?: number; hidden?: boolean; note?: string },
  ): Promise<MonthBudget> {
    await this.budgetableCategory(categoryId);
    const [versions, adjustments] = await Promise.all([
      this.budget.mainVersions(),
      this.budget.adjustments([month]),
    ]);
    const mainAmount =
      mainAsOf(month, versions).get(categoryId)?.amount ?? null;
    const existing = (adjustments.get(month) ?? []).find(
      (a) => a.categoryId === categoryId,
    );
    const hidden = dto.hidden ?? existing?.hidden ?? false;
    const note =
      dto.note !== undefined
        ? dto.note.trim() || null
        : (existing?.note ?? null);
    let amount = dto.amount ?? existing?.amount ?? null;
    if (
      !hidden &&
      dto.amount === undefined &&
      existing?.hidden &&
      amount === null
    ) {
      // Un-hiding a hidden-only row: back to the main amount.
      if (mainAmount !== null && !note)
        return this.resetMonthItem(month, categoryId);
      amount = mainAmount;
    }
    if (!hidden && amount === null) {
      throw new BadRequestException('amount is required unless hidden is true');
    }
    await this.db.query(
      `INSERT INTO budget_month_items (month, category_id, amount, hidden, note, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (month, category_id) DO UPDATE
         SET amount = EXCLUDED.amount, hidden = EXCLUDED.hidden, note = EXCLUDED.note, updated_at = now()`,
      [month, categoryId, amount, hidden, note],
    );
    return this.month(month);
  }

  async resetMonthItem(
    month: string,
    categoryId: number,
  ): Promise<MonthBudget> {
    await this.db.query(
      'DELETE FROM budget_month_items WHERE month = $1 AND category_id = $2',
      [month, categoryId],
    );
    return this.month(month);
  }

  async copyAdjustments(
    month: string,
    fromMonth: string,
  ): Promise<MonthBudget> {
    if (month === fromMonth)
      throw new BadRequestException('fromMonth must differ from month');
    const visible = (await this.budget.categories())
      .filter(isBudgetable)
      .map((c) => c.id);
    await this.db.query(
      `INSERT INTO budget_month_items (month, category_id, amount, hidden, note, updated_at)
       SELECT $1, category_id, amount, hidden, note, now() FROM budget_month_items
       WHERE month = $2 AND category_id = ANY($3::int[])
       ON CONFLICT (month, category_id) DO NOTHING`,
      [month, fromMonth, visible],
    );
    return this.month(month);
  }
}
