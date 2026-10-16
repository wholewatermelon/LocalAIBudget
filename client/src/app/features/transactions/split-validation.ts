import { SplitInput } from '../../core/models';

/** A row as edited in the dialog (fields may be empty while typing). */
export interface SplitDraft {
  categoryId: number | null;
  amount: number | string | null;
}

export interface SplitValidation {
  valid: boolean;
  /** Transaction amount minus the sum of rows, in dollars (rounded to the cent). */
  remaining: number;
  /** Row-level messages keyed by row index. */
  rowErrors: Record<number, string>;
  /** Form-level messages. */
  errors: string[];
  /** Normalized payload for PUT /splits when valid. */
  splits: SplitInput[];
}

/** Dollars -> integer cents, robust to float noise (0.1 + 0.2) and string input ("12.30", "1,234.5"). */
export function toCents(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  if (typeof value === 'string' && value.trim() === '') return null;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Mirrors server rules for PUT /api/transactions/:id/splits:
 * - empty list is valid (clears splits);
 * - every row needs a category and a non-zero amount with at most 2 decimals;
 * - every amount has the same sign as the transaction;
 * - the rows sum to the transaction amount to the cent.
 */
export function validateSplits(transactionAmount: number, rows: SplitDraft[]): SplitValidation {
  const txCents = toCents(transactionAmount) ?? 0;
  const rowErrors: Record<number, string> = {};
  const errors: string[] = [];
  const splits: SplitInput[] = [];
  let sum = 0;

  if (rows.length === 0) {
    return { valid: true, remaining: fromCents(txCents), rowErrors, errors, splits };
  }

  if (txCents === 0) errors.push('A zero-amount transaction cannot be split.');

  rows.forEach((row, i) => {
    const cents = toCents(row.amount);
    if (cents !== null) sum += cents;
    if (row.categoryId == null) {
      rowErrors[i] = 'Choose a category';
      return;
    }
    if (cents === null) {
      rowErrors[i] = 'Enter an amount';
      return;
    }
    const raw = typeof row.amount === 'number' ? row.amount : Number(String(row.amount).replace(/,/g, ''));
    if (Math.abs(raw * 100 - cents) > 1e-6) {
      rowErrors[i] = 'At most 2 decimal places';
      return;
    }
    if (cents === 0) {
      rowErrors[i] = 'Amount cannot be zero';
      return;
    }
    if (txCents !== 0 && Math.sign(cents) !== Math.sign(txCents)) {
      rowErrors[i] = txCents < 0 ? 'Must be negative (like the transaction)' : 'Must be positive (like the transaction)';
      return;
    }
    splits.push({ categoryId: row.categoryId, amount: fromCents(cents) });
  });

  const remainingCents = txCents - sum;
  if (remainingCents !== 0) {
    errors.push(
      remainingCents * Math.sign(txCents || 1) > 0
        ? `Splits are ${fmt(Math.abs(remainingCents))} short of the transaction amount.`
        : `Splits exceed the transaction amount by ${fmt(Math.abs(remainingCents))}.`,
    );
  }

  const valid = errors.length === 0 && Object.keys(rowErrors).length === 0;
  return { valid, remaining: fromCents(remainingCents), rowErrors, errors, splits: valid ? splits : [] };
}

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
