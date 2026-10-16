export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const MONTH_MESSAGE = 'month must be YYYY-MM';

export function isMonth(v: unknown): v is string {
  return typeof v === 'string' && MONTH_RE.test(v);
}

/** 'YYYY-MM' → first day 'YYYY-MM-01' and first day of next month (exclusive end). */
export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: addMonths(month, 1) + '-01' };
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}`;
}

/** Checks a 'YYYY-MM-DD' string is a real calendar date. */
export function isValidIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= dim && y >= 1900 && y <= 2100;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
export function toCents(n: number): number {
  return Math.round(n * 100);
}
