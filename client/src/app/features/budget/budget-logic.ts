import {
  MainBudgetItem,
  Month,
  MonthBudgetItem,
  MonthItemUpdate,
  RoundTo,
  SeedPreview,
  SeedRequest,
  SeedSource,
} from '../../core/models';

/** 'YYYY-MM' -> previous 'YYYY-MM'. */
export function previousMonth(month: Month): Month {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Parse a money input; null when empty, NaN-safe, rounded to cents. Negative -> 'invalid'. */
export function parseAmount(raw: string | number | null | undefined): number | null | 'invalid' {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).replace(/[$,\s]/g, '');
  if (str === '') return null;
  const n = Number(str);
  if (!Number.isFinite(n) || n < 0) return 'invalid';
  return Math.round(n * 100) / 100;
}

// ---------------- "This month" tab ----------------

export interface MonthRowState {
  chip: { label: string; cls: 'adjusted' | 'month-only' | 'hidden' | 'unbudgeted' } | null;
  greyed: boolean;
  /** Show "reset to main" (drops the adjustment / month-only item). */
  canReset: boolean;
  canHide: boolean;
  canUnhide: boolean;
  /** Note input is shown for rows that have an adjustment record. */
  hasNote: boolean;
}

export function monthRowState(item: MonthBudgetItem): MonthRowState {
  switch (item.source) {
    case 'adjusted':
      return { chip: { label: 'adjusted', cls: 'adjusted' }, greyed: false, canReset: true, canHide: true, canUnhide: false, hasNote: true };
    case 'month-only':
      return { chip: { label: 'this month only', cls: 'month-only' }, greyed: false, canReset: true, canHide: false, canUnhide: false, hasNote: true };
    case 'hidden':
      return { chip: { label: 'hidden', cls: 'hidden' }, greyed: true, canReset: false, canHide: false, canUnhide: true, hasNote: true };
    case 'unbudgeted':
      return { chip: { label: 'not budgeted', cls: 'unbudgeted' }, greyed: false, canReset: false, canHide: false, canUnhide: false, hasNote: false };
    default:
      return { chip: null, greyed: false, canReset: false, canHide: true, canUnhide: false, hasNote: false };
  }
}

export type MonthEditAction =
  | { kind: 'none' }
  | { kind: 'invalid'; message: string }
  | { kind: 'reset' }
  | { kind: 'put'; body: MonthItemUpdate };

/**
 * What to send when the "This month" amount of a row is edited.
 * - unchanged -> nothing; empty/negative -> invalid
 * - equal to the main amount with no note -> reset to main (no pointless adjustment)
 * - otherwise PUT { amount } (keeps an existing note)
 */
export function monthEditAction(item: MonthBudgetItem, raw: string | number | null): MonthEditAction {
  const amount = parseAmount(raw);
  if (amount === 'invalid') return { kind: 'invalid', message: 'Enter a positive amount' };
  if (amount === null) return { kind: 'invalid', message: 'Enter an amount (use hide to drop it this month)' };
  if (!item.hidden && amount === item.effectiveAmount) return { kind: 'none' };
  if (item.mainAmount !== null && amount === item.mainAmount && !item.note) return { kind: 'reset' };
  return { kind: 'put', body: { amount, ...(item.note ? { note: item.note } : {}) } };
}

/**
 * Un-hide: back to main when there is one (DELETE = reset); a hidden month-only amount is restored;
 * otherwise drop the hidden record (category becomes unbudgeted this month).
 */
export function unhideAction(item: MonthBudgetItem): MonthEditAction {
  if (item.mainAmount !== null) return { kind: 'reset' };
  if (item.adjustedAmount !== null) return { kind: 'put', body: { hidden: false, amount: item.adjustedAmount } };
  return { kind: 'reset' };
}

/**
 * Note edit. The server keeps the amount on a note-only PUT when an adjustment record exists
 * (adjusted / month-only / hidden); `note: ""` clears it. A plain main row has no record yet,
 * so it gets one with the current amount.
 */
export function noteEditAction(item: MonthBudgetItem, note: string): MonthEditAction {
  const trimmed = note.trim();
  if (trimmed === (item.note ?? '')) return { kind: 'none' };
  const hasRecord = item.hidden || item.source === 'adjusted' || item.source === 'month-only';
  if (hasRecord) return { kind: 'put', body: { note: trimmed } };
  const amount = item.effectiveAmount ?? item.mainAmount;
  if (amount === null) return { kind: 'invalid', message: 'Set an amount before adding a note' };
  return { kind: 'put', body: { amount, note: trimmed } };
}

// ---------------- Seed dialog ----------------

export interface SeedForm {
  fromMonth: Month;
  source: SeedSource;
  averageMonths: number;
  roundTo: RoundTo;
  effectiveFrom: Month;
}

export function buildSeedRequest(f: SeedForm): SeedRequest {
  return {
    fromMonth: f.fromMonth,
    source: f.source,
    ...(f.source === 'average' ? { averageMonths: Math.min(24, Math.max(1, Math.trunc(f.averageMonths || 3))) } : {}),
    roundTo: f.roundTo,
    effectiveFrom: f.effectiveFrom,
  };
}

export type SeedChange = 'new' | 'removed' | 'changed' | 'same';

export interface SeedDiffRow {
  categoryId: number;
  categoryName: string;
  current: number | null;
  proposed: number | null;
  change: SeedChange;
}

export interface SeedDiff {
  rows: SeedDiffRow[];
  currentTotal: number;
  proposedTotal: number;
  counts: Record<SeedChange, number>;
}

/**
 * Current vs proposed main budget. Seeding writes a NULL version for categories in main but absent from
 * the proposal, so those show as "removed".
 */
export function seedDiff(preview: SeedPreview, currentMain: MainBudgetItem[]): SeedDiff {
  const rows: SeedDiffRow[] = [];
  const proposedIds = new Set<number>();
  const currentById = new Map(currentMain.map((i) => [i.categoryId, i.amount]));
  for (const p of preview.items) {
    proposedIds.add(p.categoryId);
    const current = p.currentMainAmount ?? currentById.get(p.categoryId) ?? null;
    const change: SeedChange = current === null ? 'new' : current === p.amount ? 'same' : 'changed';
    rows.push({ categoryId: p.categoryId, categoryName: p.categoryName, current, proposed: p.amount, change });
  }
  for (const c of currentMain) {
    if (!proposedIds.has(c.categoryId)) {
      rows.push({ categoryId: c.categoryId, categoryName: c.categoryName, current: c.amount, proposed: null, change: 'removed' });
    }
  }
  rows.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  const sum = (xs: (number | null)[]) => Math.round(xs.reduce<number>((s, x) => s + (x ?? 0), 0) * 100) / 100;
  const counts: Record<SeedChange, number> = { new: 0, removed: 0, changed: 0, same: 0 };
  rows.forEach((r) => counts[r.change]++);
  return {
    rows,
    currentTotal: sum(rows.map((r) => r.current)),
    proposedTotal: sum(rows.map((r) => r.proposed)),
    counts,
  };
}
