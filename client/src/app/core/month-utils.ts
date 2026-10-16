import { Month } from './models';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidMonth(value: unknown): value is Month {
  return typeof value === 'string' && MONTH_RE.test(value);
}

export function currentMonth(now: Date = new Date()): Month {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM' -> 'Jan 2024' (display only). */
export function formatMonth(month: Month): string {
  const m = MONTH_RE.exec(month);
  if (!m) return month;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

/** Short label for chart axes: 'Jan 24'. */
export function shortMonth(month: Month): string {
  const m = MONTH_RE.exec(month);
  if (!m) return month;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short' }) + ' ' + m[1].slice(2);
}
