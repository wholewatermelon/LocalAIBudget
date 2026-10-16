import { isValidIsoDate } from '../common/month';
import { StatementPeriod } from './parse.types';

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function iso(y: number, m: number, d: number): string | null {
  const s = `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;
  return isValidIsoDate(s) ? s : null;
}

function expandYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

/**
 * Picks a year for a month/day without year: the candidate (refYear-1..refYear+1) whose date lies
 * inside the statement period (± 10 days) or, failing that, closest to the period midpoint.
 * Handles Dec→Jan periods (12/20 in a 12/15/2024–01/14/2025 statement → 2024).
 */
export function inferYear(
  month: number,
  day: number,
  period: StatementPeriod | null,
  fallbackMonth?: string,
): number {
  const ref =
    period ??
    monthToPeriod(fallbackMonth ?? new Date().toISOString().slice(0, 7));
  const start = Date.parse(ref.start);
  const end = Date.parse(ref.end);
  const mid = (start + end) / 2;
  const base = Number(ref.end.slice(0, 4));
  let best = base;
  let bestDist = Infinity;
  for (const y of [base - 1, base, base + 1]) {
    const s = iso(y, month, day);
    if (!s) continue;
    const t = Date.parse(s);
    const slack = 10 * 86400000;
    const dist = t >= start - slack && t <= end + slack ? 0 : Math.abs(t - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = y;
    }
  }
  return best;
}

export function monthToPeriod(month: string): StatementPeriod {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${pad(last)}` };
}

/**
 * Parses YYYY-MM-DD, MM/DD/YYYY, M/D/YY, MM-DD-YYYY, "Nov 15, 2024", "15 Nov 2024", and (with a period
 * or fallback month for year inference) MM/DD and "Nov 15". Returns null when invalid.
 */
export function parseDate(
  raw: string,
  period: StatementPeriod | null = null,
  fallbackMonth?: string,
): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(s);
  if (m) return iso(expandYear(+m[3]), +m[1], +m[2]);
  m = /^(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (m)
    return iso(inferYear(+m[1], +m[2], period, fallbackMonth), +m[1], +m[2]);
  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s*(\d{4})?$/.exec(s);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (!mo) return null;
    const y = m[3] ? +m[3] : inferYear(mo, +m[2], period, fallbackMonth);
    return iso(y, mo, +m[2]);
  }
  m = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s*(\d{4})?$/.exec(s);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (!mo) return null;
    const y = m[3] ? +m[3] : inferYear(mo, +m[1], period, fallbackMonth);
    return iso(y, mo, +m[1]);
  }
  return null;
}

/**
 * Parses money strings: "1,234.56", "-$12.00", "$-12.00", "(12.34)" → -12.34, "12.34-" → -12.34, "12.34 CR" → 12.34.
 * Returns null for anything that isn't a number.
 */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  let s = raw.trim().replace(/\s+/g, '');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (/CR$/i.test(s)) s = s.slice(0, -2);
  else if (/DR$/i.test(s)) {
    neg = !neg;
    s = s.slice(0, -2);
  }
  if (s.endsWith('-')) {
    neg = !neg;
    s = s.slice(0, -1);
  }
  s = s.replace(/[$€£,]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('-')) {
    neg = !neg;
    s = s.slice(1);
  }
  s = s.replace(/^\$/, '');
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/** Tries to find "statement period" / "opening/closing date" style ranges in statement text. */
export function detectStatementPeriod(text: string): StatementPeriod | null {
  const DATE = String.raw`(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})`;
  const re = new RegExp(
    DATE + String.raw`\s*(?:-|–|—|to|through|thru)\s*` + DATE,
    'i',
  );
  const lines = text.split(/\r?\n/);
  // Prefer lines that mention a period/cycle; otherwise the first range found anywhere.
  const preferred = lines.filter((l) =>
    /period|cycle|statement|opening|closing|from/i.test(l),
  );
  for (const l of [...preferred, ...lines]) {
    const m = re.exec(l);
    if (!m) continue;
    const start = parseDate(m[1].replace(/\s+/g, ' '));
    const end = parseDate(m[2].replace(/\s+/g, ' '));
    if (start && end && start <= end) return { start, end };
  }
  // "Opening Date 11/15/24 ... Closing Date 12/14/24" on separate lines
  const open = /open(?:ing)?\s*date[:\s]+(\S+)/i.exec(text);
  const close = /clos(?:ing)?\s*date[:\s]+(\S+)/i.exec(text);
  if (open && close) {
    const start = parseDate(open[1]);
    const end = parseDate(close[1]);
    if (start && end && start <= end) return { start, end };
  }
  return null;
}

export function normalizeDescription(desc: string): string {
  return desc.replace(/\s+/g, ' ').trim();
}

const MONEY = String.raw`(-?\(?-?\$?\s?[\d,]+\.\d{2}\)?-?)`;
// Optional item count before the amount ("Ending Balance 18 $3,953.55"). Not preceded by "daily".
const OPENING_RE = new RegExp(
  String.raw`(?<!daily\s)(?:beginning|opening|previous|starting|prior)\s+balance[^\d\n$(-]*(?:\d+\s+)?` +
    MONEY,
  'i',
);
const CLOSING_RE = new RegExp(
  String.raw`(?<!daily\s)(?:ending|closing|new)\s+balance[^\d\n$(-]*(?:\d+\s+)?` +
    MONEY,
  'i',
);

/** Finds opening/closing balances in statement summary text ("Beginning Balance $1,234.56", "New Balance"). */
export function detectBalances(text: string): {
  openingBalance: number | null;
  closingBalance: number | null;
} {
  const o = OPENING_RE.exec(text);
  const c = CLOSING_RE.exec(text);
  return {
    openingBalance: o ? parseAmount(o[1]) : null,
    closingBalance: c ? parseAmount(c[1]) : null,
  };
}
