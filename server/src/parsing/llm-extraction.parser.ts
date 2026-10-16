import { LlmClient } from '../llm/llm-client';
import {
  FileType,
  ParsedRow,
  ParseIssue,
  ParseResult,
  ParserInput,
  StatementMeta,
  StatementParser,
  StatementPeriod,
} from './parse.types';
import {
  detectBalances,
  detectStatementPeriod,
  monthToPeriod,
  normalizeDescription,
  parseAmount,
  parseDate,
} from './values';

export const MAX_CHUNK_CHARS = 6000;

/** Summary/non-transaction lines models sometimes return (balances, totals, rate tables). */
const SUMMARY_RE =
  /^(beginning|ending|opening|closing|new|previous|statement|daily|average)\s+balance|^balance\b|^total\b|\btotals?\s+(for|this)|annual percentage|\bapr\b|credit (limit|line)|available credit|minimum payment|payment due|cash advance limit|interest rate/i;

/** Splits pages into chunks of ≤ maxChars, never splitting a line. */
export function chunkPages(
  pages: string[],
  maxChars = MAX_CHUNK_CHARS,
): string[] {
  const chunks: string[] = [];
  for (const page of pages) {
    if (!page.trim()) continue;
    if (page.length <= maxChars) {
      chunks.push(page);
      continue;
    }
    let cur = '';
    for (const line of page.split(/\r?\n/)) {
      if (cur.length + line.length + 1 > maxChars && cur) {
        chunks.push(cur);
        cur = '';
      }
      cur += (cur ? '\n' : '') + line.slice(0, maxChars);
    }
    if (cur.trim()) chunks.push(cur);
  }
  return chunks;
}

/**
 * Validates rows returned by the model. Accepts `{transactions:[...]}` or a bare array.
 * `kind` ('debit' = money out, 'credit' = money in) decides the sign when present.
 */
export function validateExtractedRows(
  raw: unknown,
  period: StatementPeriod | null,
  fallbackMonth: string,
): { rows: ParsedRow[]; issues: ParseIssue[] } {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Array.isArray((raw as Record<string, unknown>).transactions)
        ? ((raw as Record<string, unknown>).transactions as unknown[])
        : ((Object.values(raw as Record<string, unknown>).find(
            Array.isArray,
          ) as unknown[] | undefined) ?? [])
      : [];
  const rows: ParsedRow[] = [];
  const issues: ParseIssue[] = [];
  const slack = 45 * 86400000;
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      issues.push({ message: 'LLM row is not an object' });
      continue;
    }
    const o = item as Record<string, unknown>;
    const description =
      typeof o.description === 'string'
        ? normalizeDescription(o.description)
        : '';
    const date =
      typeof o.date === 'string'
        ? parseDate(o.date, period, fallbackMonth)
        : null;
    let amount = parseAmount(
      typeof o.amount === 'number' || typeof o.amount === 'string'
        ? o.amount
        : null,
    );
    if (!description || !date || amount === null || amount === 0) {
      issues.push({
        message: `Dropped invalid LLM row: ${JSON.stringify(o).slice(0, 160)}`,
      });
      continue;
    }
    if (SUMMARY_RE.test(description)) {
      issues.push({ message: `Dropped summary row: ${description}` });
      continue;
    }
    if (period) {
      const t = Date.parse(date);
      if (
        t < Date.parse(period.start) - slack ||
        t > Date.parse(period.end) + slack
      ) {
        issues.push({
          message: `Dropped row outside statement period: ${date} ${description}`,
        });
        continue;
      }
    }
    const kind = typeof o.kind === 'string' ? o.kind.toLowerCase() : '';
    if (kind === 'debit') amount = -Math.abs(amount);
    else if (kind === 'credit') amount = Math.abs(amount);
    rows.push({
      date,
      description,
      amount: Math.round(amount * 100) / 100,
      rawText: JSON.stringify(o),
    });
  }
  return { rows, issues };
}

/** Reads {"statement": {openingBalance, closingBalance}} from an extraction response. */
export function extractBalancesFromLlm(raw: unknown): StatementMeta {
  const st =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>).statement
      : null;
  if (!st || typeof st !== 'object') return {};
  const o = st as Record<string, unknown>;
  const val = (v: unknown) =>
    typeof v === 'number' || typeof v === 'string' ? parseAmount(v) : null;
  return {
    openingBalance: val(o.openingBalance),
    closingBalance: val(o.closingBalance),
  };
}

export function buildExtractionPrompt(
  chunk: string,
  i: number,
  total: number,
  periodText: string,
  isCard: boolean,
): string {
  const first = i === 0;
  const shape = first
    ? '{"statement": {"openingBalance": <number or null>, "closingBalance": <number or null>}, "transactions": [...]}'
    : '{"transactions": [...]}';
  const lines = [
    `Extract every individual transaction from this ${isCard ? 'credit card' : 'bank account'} statement text (part ${i + 1} of ${total}).`,
    `Statement period: ${periodText}.`,
    '',
    `Return JSON: ${shape}`,
    'Each transaction: {"date": "<date exactly as printed, e.g. 11/18 or 11/18/2024>", "description": "<merchant/description>", "amount": <positive number>, "kind": "debit" | "credit"}',
    '- "debit" = money leaving the account holder (purchase, fee, interest charged, withdrawal, check, bill payment).',
    '- "credit" = money coming in (deposit, salary, refund, payment received on the card).',
    '- Use the transaction date, not the posting date. Amount without currency symbols or thousands separators.',
    '- Do NOT include balances, totals, subtotals, summaries, interest-rate tables, minimum payment or credit limit lines.',
    '- If there are no transactions in this part, return an empty "transactions" array.',
  ];
  if (first) {
    lines.push(
      '- "statement": the previous/opening and new/closing balance from the summary box, as printed (positive numbers for amounts owed on a card), or null.',
    );
  }
  lines.push('', 'Statement text:', '"""', chunk, '"""');
  return lines.join('\n');
}

export class LlmExtractionParser implements StatementParser {
  readonly method = 'llm' as const;
  constructor(private readonly llm: LlmClient) {}

  supports(t: FileType): boolean {
    return t === 'pdf' || t === 'txt';
  }

  async parse(input: ParserInput): Promise<ParseResult | null> {
    if (!input.text.trim()) return null;
    const period = detectStatementPeriod(input.text);
    const periodText = period
      ? `${period.start} to ${period.end}`
      : `month ${input.ctx.month} (${monthToPeriod(input.ctx.month).start} to ${monthToPeriod(input.ctx.month).end})`;
    const isCard = /card/i.test(input.ctx.accountType);
    const rows: ParsedRow[] = [];
    const issues: ParseIssue[] = [];
    const meta: StatementMeta = {
      periodStart: period?.start ?? null,
      periodEnd: period?.end ?? null,
    };
    const chunks = chunkPages(input.pages.length ? input.pages : [input.text]);
    for (const [i, chunk] of chunks.entries()) {
      const prompt = buildExtractionPrompt(
        chunk,
        i,
        chunks.length,
        periodText,
        isCard,
      );
      const raw = await this.llm.generateJson({ task: 'extract', prompt });
      if (i === 0) {
        // Regex-found balances win; the model only fills gaps.
        const fromText = detectBalances(input.text);
        const fromLlm = extractBalancesFromLlm(raw);
        meta.openingBalance =
          fromText.openingBalance ?? fromLlm.openingBalance ?? null;
        meta.closingBalance =
          fromText.closingBalance ?? fromLlm.closingBalance ?? null;
      }
      const v = validateExtractedRows(raw, period, input.ctx.month);
      rows.push(...v.rows);
      issues.push(...v.issues);
    }
    return rows.length || issues.length
      ? { method: 'llm', signs: 'normalized', rows, issues, meta }
      : null;
  }
}
