import { createHash } from 'crypto';
import { ParsedRow } from '../parsing/parse.types';

/** Uppercase + collapse whitespace — used for dedupe keys and rule matching. */
export function normalizeForMatch(desc: string): string {
  return desc.toUpperCase().replace(/\s+/g, ' ').trim();
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * dedupe_key = sha256(account_id | date | normalized description | amount | occurrence), where occurrence is the
 * 1-based count of identical (date, description, amount) rows within the same file. OFX rows with a FITID use
 * sha256(account_id | 'fitid' | FITID) instead. Returns one key per row, same order.
 */
export function computeDedupeKeys(
  accountId: number,
  rows: ParsedRow[],
): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    if (r.fitid) return sha256(`${accountId}|fitid|${r.fitid}`);
    const base = `${r.date}|${normalizeForMatch(r.description)}|${r.amount.toFixed(2)}`;
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    return sha256(`${accountId}|${base}|${occurrence}`);
  });
}
