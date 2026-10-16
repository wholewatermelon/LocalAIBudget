/**
 * Pure logic for the main budget (versioned) + month adjustments (ARCHITECTURE.md section H).
 */

export interface MainVersion {
  categoryId: number;
  effectiveFrom: string; // 'YYYY-MM'
  amount: number | null; // null = removed from main from this month on (tombstone)
}

export interface MonthAdjustment {
  categoryId: number;
  amount: number | null;
  hidden: boolean;
  note: string | null;
}

export type BudgetSource =
  'main' | 'adjusted' | 'month-only' | 'hidden' | 'unbudgeted';

export interface MainAsOf {
  amount: number;
  effectiveFrom: string;
  hasLaterChange: boolean;
}

/** Main budget as of `month`: latest version with effective_from <= month; tombstoned categories are absent. */
export function mainAsOf(
  month: string,
  versions: MainVersion[],
): Map<number, MainAsOf> {
  const latest = new Map<number, MainVersion>();
  const later = new Set<number>();
  for (const v of versions) {
    if (v.effectiveFrom > month) {
      later.add(v.categoryId);
      continue;
    }
    const cur = latest.get(v.categoryId);
    if (!cur || v.effectiveFrom > cur.effectiveFrom)
      latest.set(v.categoryId, v);
  }
  const out = new Map<number, MainAsOf>();
  for (const [id, v] of latest) {
    if (v.amount === null) continue;
    out.set(id, {
      amount: v.amount,
      effectiveFrom: v.effectiveFrom,
      hasLaterChange: later.has(id),
    });
  }
  return out;
}

export interface EffectiveBudget {
  categoryId: number;
  mainAmount: number | null;
  adjustedAmount: number | null;
  hidden: boolean;
  note: string | null;
  effectiveAmount: number | null;
  source: BudgetSource;
}

/** Effective budget for (month, category) = adjustment if present, else the main amount as of the month. */
export function resolveEffective(
  categoryId: number,
  main: Map<number, MainAsOf>,
  adjustment: MonthAdjustment | undefined,
): EffectiveBudget {
  const mainAmount = main.get(categoryId)?.amount ?? null;
  const base = {
    categoryId,
    mainAmount,
    adjustedAmount: null,
    hidden: false,
    note: null,
  };
  if (adjustment) {
    const common = {
      ...base,
      adjustedAmount: adjustment.hidden ? null : adjustment.amount,
      note: adjustment.note,
    };
    if (adjustment.hidden)
      return {
        ...common,
        hidden: true,
        effectiveAmount: null,
        source: 'hidden',
      };
    if (adjustment.amount !== null) {
      return {
        ...common,
        effectiveAmount: adjustment.amount,
        source: mainAmount === null ? 'month-only' : 'adjusted',
      };
    }
  }
  if (mainAmount !== null)
    return { ...base, effectiveAmount: mainAmount, source: 'main' };
  return { ...base, effectiveAmount: null, source: 'unbudgeted' };
}

/** Effective amounts for every category that has one in `month` (hidden/unbudgeted omitted). */
export function effectiveBudgetMap(
  month: string,
  versions: MainVersion[],
  adjustments: MonthAdjustment[],
): Map<number, number> {
  const main = mainAsOf(month, versions);
  const adj = new Map(adjustments.map((a) => [a.categoryId, a]));
  const ids = new Set<number>([...main.keys(), ...adj.keys()]);
  const out = new Map<number, number>();
  for (const id of ids) {
    const e = resolveEffective(id, main, adj.get(id));
    if (e.effectiveAmount !== null) out.set(id, e.effectiveAmount);
  }
  return out;
}

export type RoundTo = 1 | 5 | 10 | 25 | 50;
export const ROUND_TO_VALUES: RoundTo[] = [1, 5, 10, 25, 50];

/** Rounds UP to the next multiple of `roundTo` (works in cents to avoid float drift). */
export function roundUp(amount: number, roundTo: RoundTo): number {
  const cents = Math.round(amount * 100);
  const step = roundTo * 100;
  return (Math.ceil(cents / step) * step) / 100;
}

/** Mean of per-month spend over the months that had any transactions at all (empty months skipped). */
export function averageSpent(
  monthsWithData: Set<string>,
  spentByMonth: Map<string, Map<number, number>>,
  months: string[],
): Map<number, number> {
  const used = months.filter((m) => monthsWithData.has(m));
  const sums = new Map<number, number>();
  for (const m of used) {
    for (const [id, v] of spentByMonth.get(m) ?? [])
      sums.set(id, (sums.get(id) ?? 0) + v);
  }
  const out = new Map<number, number>();
  if (!used.length) return out;
  for (const [id, s] of sums) out.set(id, s / used.length);
  return out;
}

export interface SeedProposalItem {
  categoryId: number;
  amount: number;
}

/** Rounds up, drops zero/negative amounts, keeps only budgetable categories. */
export function buildSeedProposal(
  raw: Map<number, number>,
  budgetable: Set<number>,
  roundTo: RoundTo,
): SeedProposalItem[] {
  const out: SeedProposalItem[] = [];
  for (const [categoryId, value] of raw) {
    if (!budgetable.has(categoryId)) continue;
    const amount = roundUp(Math.max(0, value), roundTo);
    if (amount > 0) out.push({ categoryId, amount });
  }
  return out;
}

/**
 * Versions to write at `effectiveFrom` so that main-as-of(effectiveFrom) equals the proposal:
 * one per proposed item plus a NULL tombstone for every category currently in main but absent from the proposal.
 */
export function seedWrites(
  proposal: SeedProposalItem[],
  currentMain: Map<number, MainAsOf>,
): { categoryId: number; amount: number | null }[] {
  const proposed = new Set(proposal.map((p) => p.categoryId));
  const tombstones = [...currentMain.keys()]
    .filter((id) => !proposed.has(id))
    .map((categoryId) => ({ categoryId, amount: null }));
  return [
    ...proposal.map((p) => ({ categoryId: p.categoryId, amount: p.amount })),
    ...tombstones,
  ];
}
