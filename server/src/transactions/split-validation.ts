import { toCents } from '../common/month';

/**
 * Returns an error message, or null when valid. Rules: every split amount non-zero and with the same sign as the
 * transaction; the sum equals the transaction amount to the cent. An empty list is valid (clears splits).
 */
export function validateSplits(
  transactionAmount: number,
  splits: { categoryId: number; amount: number }[],
): string | null {
  if (!splits.length) return null;
  const total = toCents(transactionAmount);
  if (total === 0) return 'Cannot split a zero-amount transaction';
  const sign = Math.sign(total);
  for (const [i, s] of splits.entries()) {
    const c = toCents(s.amount);
    if (c === 0) return `Split ${i + 1}: amount must be non-zero`;
    if (Math.sign(c) !== sign)
      return `Split ${i + 1}: amount must have the same sign as the transaction (${transactionAmount})`;
    if (Math.abs(s.amount * 100 - c) > 1e-6)
      return `Split ${i + 1}: amount has more than 2 decimals`;
  }
  const sum = splits.reduce((acc, s) => acc + toCents(s.amount), 0);
  if (sum !== total) {
    return `Splits must sum to the transaction amount ${transactionAmount.toFixed(2)} (got ${(sum / 100).toFixed(2)})`;
  }
  return null;
}
