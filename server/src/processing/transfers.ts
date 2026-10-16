import { toCents } from '../common/month';

export const TRANSFER_RE = /PAYMENT|TRANSFER|XFER|AUTOPAY|ONLINE PMT|EPAY/i;

export interface TransferCandidate {
  id: number;
  accountId: number | null;
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
  categoryIsTransfer?: boolean;
}

export function looksLikeTransfer(
  c: Pick<TransferCandidate, 'description' | 'categoryIsTransfer'>,
): boolean {
  return TRANSFER_RE.test(c.description) || !!c.categoryIsTransfer;
}

const DAY = 86400000;
export const MAX_TRANSFER_DAYS = 5;

/**
 * Pairs rows across different accounts where a.amount = -b.amount (to the cent), dates within 5 days and at least
 * one side looks like a payment/transfer. Greedy by closest date (then lowest ids), each row used at most once.
 */
export function findTransferPairs(
  cands: TransferCandidate[],
): [number, number][] {
  const options: {
    a: TransferCandidate;
    b: TransferCandidate;
    days: number;
  }[] = [];
  const byCents = new Map<number, TransferCandidate[]>();
  for (const c of cands) {
    if (c.accountId === null || c.amount === 0) continue;
    const k = toCents(c.amount);
    byCents.set(k, [...(byCents.get(k) ?? []), c]);
  }
  for (const a of cands) {
    if (a.accountId === null || a.amount >= 0) continue; // a = outflow side
    for (const b of byCents.get(-toCents(a.amount)) ?? []) {
      if (b.accountId === a.accountId) continue;
      if (!looksLikeTransfer(a) && !looksLikeTransfer(b)) continue;
      const days = Math.abs(Date.parse(a.date) - Date.parse(b.date)) / DAY;
      if (days > MAX_TRANSFER_DAYS) continue;
      options.push({ a, b, days });
    }
  }
  options.sort((x, y) => x.days - y.days || x.a.id - y.a.id || x.b.id - y.b.id);
  const used = new Set<number>();
  const pairs: [number, number][] = [];
  for (const o of options) {
    if (used.has(o.a.id) || used.has(o.b.id)) continue;
    used.add(o.a.id);
    used.add(o.b.id);
    pairs.push([o.a.id, o.b.id]);
  }
  return pairs;
}
