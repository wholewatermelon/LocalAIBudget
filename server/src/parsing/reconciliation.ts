import { round2 } from '../common/month';
import { isCardAccount } from './sign-normalization';

export interface ReconciliationResult {
  status: 'ok' | 'mismatch' | 'unknown';
  parsedTotal: number;
  diff: number | null;
}

/**
 * bank: opening + Σ amounts = closing.  card (balances are amounts owed): opening − Σ normalized amounts = closing.
 * Tolerance 0.01. Missing balance → 'unknown'. `diff` = expected closing − printed closing.
 */
export function reconcile(
  amounts: number[],
  openingBalance: number | null | undefined,
  closingBalance: number | null | undefined,
  accountType: string,
): ReconciliationResult {
  const parsedTotal = round2(amounts.reduce((s, a) => s + a, 0));
  if (openingBalance == null || closingBalance == null)
    return { status: 'unknown', parsedTotal, diff: null };
  const expected = isCardAccount(accountType)
    ? openingBalance - parsedTotal
    : openingBalance + parsedTotal;
  const diff = round2(expected - closingBalance);
  return {
    status: Math.abs(diff) <= 0.01 ? 'ok' : 'mismatch',
    parsedTotal,
    diff,
  };
}
