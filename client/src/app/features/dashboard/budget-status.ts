export type BudgetStatus = 'none' | 'ok' | 'warn' | 'over';

export const WARN_THRESHOLD = 80;
export const OVER_THRESHOLD = 100;

/** Percent of budget used (0..∞), or null when no limit is set. */
export function percentUsed(spent: number, budgetLimit: number): number | null {
  if (!(budgetLimit > 0)) return null;
  return (Math.max(0, spent) / budgetLimit) * 100;
}

/**
 * Bar color by percent used: green < 80, amber 80-100 (inclusive), red > 100.
 * 'none' = no budget limit set (neutral bar).
 */
export function budgetStatus(spent: number, budgetLimit: number): BudgetStatus {
  const pct = percentUsed(spent, budgetLimit);
  if (pct === null) return 'none';
  // Compare in hundredths of a percent to avoid float noise at the 80/100 boundaries.
  const p = Math.round(pct * 100);
  if (p < WARN_THRESHOLD * 100) return 'ok';
  if (p <= OVER_THRESHOLD * 100) return 'warn';
  return 'over';
}

export const STATUS_LABEL: Record<BudgetStatus, string> = {
  none: 'No limit',
  ok: 'On track',
  warn: 'Near limit',
  over: 'Over budget',
};
