import { isValidIsoDate } from '../common/month';
import {
  ParsedRow,
  ParseIssue,
  ParseResult,
  ParserInput,
  StatementParser,
  FileType,
} from './parse.types';
import {
  detectBalances,
  detectStatementPeriod,
  normalizeDescription,
  parseAmount,
} from './values';
import { StatementMeta } from './parse.types';

/** Period + balances found by regex in statement text. */
export function textMeta(text: string): StatementMeta {
  const p = detectStatementPeriod(text);
  return {
    periodStart: p?.start ?? null,
    periodEnd: p?.end ?? null,
    ...detectBalances(text),
  };
}

export const LINE_RE = /^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})$/;

/** Pure function: parses simple `YYYY-MM-DD Description -1,234.56` lines; everything else is ignored. */
export function parseRegexLines(text: string): {
  rows: ParsedRow[];
  issues: ParseIssue[];
} {
  const rows: ParsedRow[] = [];
  const issues: ParseIssue[] = [];
  text.split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    const m = LINE_RE.exec(line);
    if (!m) return;
    const amount = parseAmount(m[3]);
    if (!isValidIsoDate(m[1]) || amount === null) {
      issues.push({ line: i + 1, message: `Invalid date or amount: ${line}` });
      return;
    }
    rows.push({
      date: m[1],
      description: normalizeDescription(m[2]),
      amount,
      rawText: line,
    });
  });
  return { rows, issues };
}

export class RegexLineParser implements StatementParser {
  readonly method = 'regex' as const;
  supports(t: FileType): boolean {
    return t === 'pdf' || t === 'txt';
  }
  parse(input: ParserInput): Promise<ParseResult | null> {
    const { rows, issues } = parseRegexLines(input.text);
    return Promise.resolve(
      rows.length
        ? {
            method: this.method,
            signs: 'as-printed',
            rows,
            issues,
            meta: textMeta(input.text),
          }
        : null,
    );
  }
}
