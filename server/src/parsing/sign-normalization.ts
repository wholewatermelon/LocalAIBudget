import { ParsedRow } from './parse.types';

export function isCardAccount(accountType: string, name = ''): boolean {
  return /credit\s*card/i.test(accountType) || /card/i.test(name);
}

/**
 * Card statements usually list purchases as positive and payments/refunds as negative.
 * For card accounts whose rows are mostly positive, negate every row so negative = money out.
 */
export function normalizeSigns(
  rows: ParsedRow[],
  accountType: string,
): { rows: ParsedRow[]; flipped: boolean } {
  if (!rows.length || !isCardAccount(accountType))
    return { rows, flipped: false };
  const positives = rows.filter((r) => r.amount > 0).length;
  if (positives * 2 <= rows.length) return { rows, flipped: false };
  return {
    rows: rows.map((r) => ({ ...r, amount: r.amount === 0 ? 0 : -r.amount })),
    flipped: true,
  };
}
