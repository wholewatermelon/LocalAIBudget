import { toCents } from '../common/month';
import {
  FileType,
  ParsedRow,
  ParseIssue,
  ParseResult,
  ParserInput,
  StatementParser,
  StatementPeriod,
} from './parse.types';
import { textMeta } from './regex-line.parser';
import {
  monthToPeriod,
  normalizeDescription,
  parseAmount,
  parseDate,
} from './values';

/**
 * Deterministic parsers for the two common PDF table layouts (pdf-parse v2 joins cells with single spaces and drops
 * empty cells, so column positions are lost):
 *
 *  - running balance (bank):  `MM/DD <description> <amount> <balance>` — sign from the balance delta, seeded by
 *    "Beginning Balance". Parsing stops at "Ending Balance" / "DAILY ENDING BALANCE".
 *  - two dates (card):        `MM/DD MM/DD <description> <amount>` — Trans Date first; amounts as printed.
 *
 * A wrapped description (the next line, no date/amount, not a header/footer) is joined onto the row.
 */

const NOISE_RE =
  /^(payments?( and other credits)?|(other )?credits|purchases?( and (adjustments|other charges))?|fees( charged)?|interest charged|cash advances|balance transfers|account activity.*|transaction detail|trans(action)? date\b.*|date description\b.*|total\b.*|.*\bpage \d+ of \d+.*|--\s*\d+ of \d+\s*--|.*\(continued\).*)$/i;
const MONEY = String.raw`-?\$?[\d,]+\.\d{2}`;
const BANK_ROW = new RegExp(
  String.raw`^(\d{1,2}\/\d{1,2})\s+(.+?)\s+(${MONEY})\s+(${MONEY})$`,
);
const CARD_ROW = new RegExp(
  String.raw`^(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})\s+(.+?)\s+(${MONEY})$`,
);
const ANY_AMOUNT = /\d\.\d{2}\b/;
const BEGINNING_RE = /beginning balance\s+\$?([\d,]+\.\d{2})/i;
const STOP_RE = /^(ending balance\b|daily (ending )?balance)/i;

function lines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim());
}

function isContinuation(line: string): boolean {
  return (
    !!line &&
    !NOISE_RE.test(line) &&
    !ANY_AMOUNT.test(line) &&
    !/^\d{1,2}\/\d{1,2}\b/.test(line) &&
    line.length <= 80
  );
}

function periodFor(input: ParserInput): StatementPeriod {
  const m = textMeta(input.text);
  return m.periodStart && m.periodEnd
    ? { start: m.periodStart, end: m.periodEnd }
    : monthToPeriod(input.ctx.month);
}

/** Bank statement with WITHDRAWALS / DEPOSITS / BALANCE columns. */
export function parseRunningBalanceTable(
  text: string,
  period: StatementPeriod,
): { rows: ParsedRow[]; issues: ParseIssue[] } | null {
  const seed = BEGINNING_RE.exec(text);
  if (!seed) return null;
  let prev = parseAmount(seed[1]);
  if (prev === null) return null;
  const rows: ParsedRow[] = [];
  const issues: ParseIssue[] = [];
  const ls = lines(text);
  let lastWasRow = false;
  let started = false;
  for (const [i, line] of ls.entries()) {
    if (started && STOP_RE.test(line)) break;
    const m = BANK_ROW.exec(line);
    if (m) {
      const date = parseDate(m[1], period);
      const amount = parseAmount(m[3]);
      const balance = parseAmount(m[4]);
      if (!date || amount === null || balance === null) {
        issues.push({ line: i + 1, message: `Unparseable row: ${line}` });
        lastWasRow = false;
        continue;
      }
      started = true;
      const delta = toCents(balance) - toCents(prev);
      const abs = Math.abs(amount);
      if (Math.abs(delta) !== toCents(abs)) {
        issues.push({
          line: i + 1,
          message: `Running balance does not match amount (${line})`,
        });
      }
      const signed = delta < 0 ? -abs : abs;
      rows.push({
        date,
        description: normalizeDescription(m[2]),
        amount: signed,
        rawText: line,
      });
      prev = balance;
      lastWasRow = true;
      continue;
    }
    if (lastWasRow && isContinuation(line)) {
      const r = rows[rows.length - 1];
      r.description = normalizeDescription(`${r.description} ${line}`);
      r.rawText = `${r.rawText}\n${line}`;
    }
    lastWasRow = false;
  }
  return rows.length ? { rows, issues } : null;
}

/** Card statement with Trans Date / Post Date / Description / Amount. Amounts as printed. */
export function parseTwoDateTable(
  text: string,
  period: StatementPeriod,
): { rows: ParsedRow[]; issues: ParseIssue[] } | null {
  const rows: ParsedRow[] = [];
  const issues: ParseIssue[] = [];
  let lastWasRow = false;
  for (const [i, line] of lines(text).entries()) {
    const m = CARD_ROW.exec(line);
    if (m) {
      const date = parseDate(m[1], period);
      const amount = parseAmount(m[4]);
      if (!date || amount === null) {
        issues.push({ line: i + 1, message: `Unparseable row: ${line}` });
        lastWasRow = false;
        continue;
      }
      rows.push({
        date,
        description: normalizeDescription(m[3]),
        amount,
        rawText: line,
      });
      lastWasRow = true;
      continue;
    }
    if (lastWasRow && isContinuation(line)) {
      const r = rows[rows.length - 1];
      r.description = normalizeDescription(`${r.description} ${line}`);
      r.rawText = `${r.rawText}\n${line}`;
    }
    lastWasRow = false;
  }
  return rows.length ? { rows, issues } : null;
}

export class RunningBalanceTableParser implements StatementParser {
  readonly method = 'regex' as const;
  supports(t: FileType): boolean {
    return t === 'pdf' || t === 'txt';
  }
  parse(input: ParserInput): Promise<ParseResult | null> {
    const r = parseRunningBalanceTable(input.text, periodFor(input));
    if (!r) return Promise.resolve(null);
    return Promise.resolve({
      method: 'regex',
      signs: 'normalized',
      ...r,
      meta: textMeta(input.text),
    });
  }
}

export class TwoDateTableParser implements StatementParser {
  readonly method = 'regex' as const;
  supports(t: FileType): boolean {
    return t === 'pdf' || t === 'txt';
  }
  parse(input: ParserInput): Promise<ParseResult | null> {
    const r = parseTwoDateTable(input.text, periodFor(input));
    if (!r) return Promise.resolve(null);
    return Promise.resolve({
      method: 'regex',
      signs: 'as-printed',
      ...r,
      meta: textMeta(input.text),
    });
  }
}
