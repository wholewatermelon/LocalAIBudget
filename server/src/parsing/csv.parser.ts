import { parse } from 'csv-parse/sync';
import { LlmClient } from '../llm/llm-client';
import {
  FileType,
  ParsedRow,
  ParseIssue,
  ParseResult,
  ParserInput,
  StatementMeta,
  StatementParser,
} from './parse.types';
import { isCardAccount } from './sign-normalization';
import {
  detectStatementPeriod,
  normalizeDescription,
  parseAmount,
  parseDate,
} from './values';

/** Column indexes into a CSV record. Either `amount` or at least one of `debit`/`credit` is set. */
export interface CsvColumnMapping {
  headerRow: number; // index into the non-empty records; -1 = no header
  date: number;
  description: number;
  amount?: number | null;
  debit?: number | null;
  credit?: number | null;
  balance?: number | null;
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');

// Ordered by preference (transaction date beats post date).
const DATE_HEADERS = [
  'transactiondate',
  'transdate',
  'trandate',
  'date',
  'postingdate',
  'posteddate',
  'postdate',
];
const DESC_HEADERS = [
  'description',
  'transactiondescription',
  'payee',
  'merchant',
  'merchantname',
  'name',
  'details',
  'narrative',
  'memo',
];
const AMOUNT_HEADERS = ['amount', 'transactionamount', 'amountusd'];
const DEBIT_HEADERS = [
  'debit',
  'debits',
  'debitamount',
  'withdrawal',
  'withdrawals',
  'moneyout',
  'amountdebit',
];
const BALANCE_HEADERS = ['balance', 'runningbalance', 'ledgerbalance'];
const CREDIT_HEADERS = [
  'credit',
  'credits',
  'creditamount',
  'deposit',
  'deposits',
  'moneyin',
  'amountcredit',
];

function findCol(headers: string[], candidates: string[]): number | null {
  const n = headers.map(norm);
  for (const c of candidates) {
    const i = n.indexOf(c);
    if (i >= 0) return i;
  }
  return null;
}

/** Splits CSV text into records (quoted fields, embedded commas, BOM, ragged rows). Drops fully blank rows. */
export function readCsvRecords(text: string): string[][] {
  const records: string[][] = parse(text, {
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
    trim: true,
  });
  return records.filter((r) => r.some((c) => c !== ''));
}

/** Header-name heuristics. Scans the first 15 records for a header row (handles preamble lines). */
export function detectCsvMapping(records: string[][]): CsvColumnMapping | null {
  for (let i = 0; i < Math.min(records.length, 15); i++) {
    const h = records[i];
    const date = findCol(h, DATE_HEADERS);
    const description = findCol(h, DESC_HEADERS);
    if (date === null || description === null) continue;
    const amount = findCol(h, AMOUNT_HEADERS);
    const debit = findCol(h, DEBIT_HEADERS);
    const credit = findCol(h, CREDIT_HEADERS);
    if (amount === null && debit === null && credit === null) continue;
    return {
      headerRow: i,
      date,
      description,
      amount,
      debit,
      credit,
      balance: findCol(h, BALANCE_HEADERS),
    };
  }
  return null;
}

/** Deterministic row extraction for a known mapping. Rows whose date/amount don't parse are reported and skipped. */
export function applyCsvMapping(
  records: string[][],
  map: CsvColumnMapping,
  opts: { month?: string } = {},
): {
  rows: ParsedRow[];
  issues: ParseIssue[];
  split: boolean;
  balances: (number | null)[];
} {
  const balances: (number | null)[] = [];
  const rows: ParsedRow[] = [];
  const issues: ParseIssue[] = [];
  const split = map.amount === null || map.amount === undefined;
  for (let i = map.headerRow + 1; i < records.length; i++) {
    const r = records[i];
    const rawDate = r[map.date] ?? '';
    const date = parseDate(rawDate, null, opts.month);
    const description = normalizeDescription(r[map.description] ?? '');
    let amount: number | null;
    if (!split) {
      amount = parseAmount(r[map.amount as number] ?? '');
    } else {
      const d = map.debit != null ? parseAmount(r[map.debit] ?? '') : null;
      const c = map.credit != null ? parseAmount(r[map.credit] ?? '') : null;
      amount = d
        ? -Math.abs(d)
        : c
          ? Math.abs(c)
          : d === 0 || c === 0
            ? 0
            : null;
    }
    if (!date || amount === null || !description) {
      // Footer/summary lines ("Total", "Ending balance") are expected here — report quietly.
      issues.push({
        line: i + 1,
        message: `Skipped CSV row: ${r.join(',').slice(0, 120)}`,
      });
      continue;
    }
    if (amount === 0) continue;
    rows.push({ date, description, amount, rawText: r.join(',') });
    balances.push(
      map.balance != null ? parseAmount(r[map.balance] ?? '') : null,
    );
  }
  return { rows, issues, split, balances };
}

/** Validates an LLM-suggested mapping against the record shape. */
export function validateLlmMapping(
  raw: unknown,
  records: string[][],
): CsvColumnMapping | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const idx = (v: unknown): number | null =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
  const headerRow =
    typeof o.headerRow === 'number' && Number.isInteger(o.headerRow)
      ? o.headerRow
      : 0;
  const date = idx(o.date);
  const description = idx(o.description);
  const amount = idx(o.amount);
  const debit = idx(o.debit);
  const credit = idx(o.credit);
  if (date === null || description === null) return null;
  if (amount === null && debit === null && credit === null) return null;
  const width = Math.max(...records.slice(0, 20).map((r) => r.length));
  if (
    [date, description, amount, debit, credit].some(
      (v) => v !== null && v >= width,
    )
  )
    return null;
  if (headerRow < -1 || headerRow >= records.length) return null;
  return { headerRow, date, description, amount, debit, credit, balance: null };
}

/**
 * Bank CSVs with a running Balance column: opening = balance before the first (oldest) row, closing = balance after
 * the last. Works whether the export is oldest-first or newest-first.
 */
export function balancesFromRunningBalance(
  rows: ParsedRow[],
  balances: (number | null)[],
): StatementMeta {
  if (!rows.length || balances.some((b) => b === null)) return {};
  const newestFirst = rows[0].date > rows[rows.length - 1].date;
  const oldest = newestFirst ? rows.length - 1 : 0;
  const newest = newestFirst ? 0 : rows.length - 1;
  const opening =
    Math.round(((balances[oldest] as number) - rows[oldest].amount) * 100) /
    100;
  const sorted = [...rows.map((r) => r.date)].sort();
  return {
    openingBalance: opening,
    closingBalance: balances[newest],
    periodStart: sorted[0],
    periodEnd: sorted[sorted.length - 1],
  };
}

export class CsvStatementParser implements StatementParser {
  readonly method = 'csv' as const;
  constructor(private readonly llm: LlmClient) {}

  supports(t: FileType): boolean {
    return t === 'csv';
  }

  async parse(input: ParserInput): Promise<ParseResult | null> {
    const records = readCsvRecords(input.text);
    if (!records.length) return null;
    let mapping = detectCsvMapping(records);
    const issues: ParseIssue[] = [];
    if (!mapping) {
      mapping = await this.askLlmForMapping(records);
      if (!mapping) {
        return {
          method: 'csv',
          signs: 'as-printed',
          rows: [],
          issues: [
            {
              message:
                'Could not map CSV columns (header heuristics and LLM both failed)',
            },
          ],
        };
      }
      issues.push({ message: 'CSV columns mapped by LLM' });
    }
    const res = applyCsvMapping(records, mapping, { month: input.ctx.month });
    const meta: StatementMeta = isCardAccount(input.ctx.accountType)
      ? {}
      : balancesFromRunningBalance(res.rows, res.balances);
    // A preamble like "Date Range: 01/01/2025 - 01/31/2025" beats the min/max row dates.
    const preamble = records
      .slice(0, mapping.headerRow + 1)
      .map((r) => r.join(' '));
    const stated = detectStatementPeriod(preamble.join('\n'));
    if (stated) {
      meta.periodStart = stated.start;
      meta.periodEnd = stated.end;
    }
    return {
      method: 'csv',
      meta,
      // Debit/Credit columns are unambiguous; a single Amount column follows the bank's own convention.
      signs: res.split ? 'normalized' : 'as-printed',
      rows: res.rows,
      issues: [...issues, ...res.issues],
    };
  }

  private async askLlmForMapping(
    records: string[][],
  ): Promise<CsvColumnMapping | null> {
    const sample = records
      .slice(0, 8)
      .map((r, i) => `${i}: ${JSON.stringify(r)}`)
      .join('\n');
    const prompt = `These are the first records of a bank/credit card CSV export (record index: JSON array of cells).
${sample}

Identify the header record and the 0-based column index for each field. Return JSON:
{"headerRow": <record index of the header, or -1 if there is none>, "date": <col>, "description": <col>,
 "amount": <col or null if separate debit/credit columns>, "debit": <col or null>, "credit": <col or null>}
Prefer the transaction date over the posting date. Never choose a balance column.`;
    const raw = await this.llm.generateJson({ task: 'csv-mapping', prompt });
    return validateLlmMapping(raw, records);
  }
}
