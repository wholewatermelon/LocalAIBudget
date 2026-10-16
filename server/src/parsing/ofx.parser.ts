import { isValidIsoDate } from '../common/month';
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
import { normalizeDescription, parseAmount } from './values';

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

/** Value of an OFX element — works for SGML (unclosed `<TAG>value`) and XML (`<TAG>value</TAG>`). */
export function ofxField(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([^<\r\n]*)`, 'i').exec(block);
  return m ? decode(m[1]) || null : null;
}

/** `20241115120000[-5:EST]` → `2024-11-15` */
export function ofxDate(v: string | null): string | null {
  if (!v) return null;
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v.trim());
  if (!m) return null;
  const s = `${m[1]}-${m[2]}-${m[3]}`;
  return isValidIsoDate(s) ? s : null;
}

/**
 * NAME is truncated to 32 chars by many banks; MEMO then holds the full text. MEMO when it starts with NAME,
 * else NAME (+ ' ' + MEMO when present and different).
 */
export function ofxDescription(
  name: string | null,
  memo: string | null,
): string {
  const n = normalizeDescription(name ?? '');
  const m = normalizeDescription(memo ?? '');
  if (!n) return m;
  if (!m || m === n) return n;
  return m.startsWith(n) ? m : `${n} ${m}`;
}

/** Parses OFX 1.x (SGML) and 2.x (XML). TRNAMT already uses negative = money out. */
export function parseOfx(
  text: string,
  accountType = 'Bank',
): { rows: ParsedRow[]; issues: ParseIssue[]; meta: StatementMeta } {
  const rows: ParsedRow[] = [];
  const issues: ParseIssue[] = [];
  const blocks = text
    .split(/<STMTTRN>/i)
    .slice(1)
    .map((b) => b.split(/<\/STMTTRN>/i)[0]);
  for (const b of blocks) {
    const date = ofxDate(ofxField(b, 'DTPOSTED'));
    const amount = parseAmount(ofxField(b, 'TRNAMT'));
    const description = ofxDescription(
      ofxField(b, 'NAME'),
      ofxField(b, 'MEMO'),
    );
    const fitid = ofxField(b, 'FITID') ?? undefined;
    if (!date || amount === null || !description) {
      issues.push({
        message: `Skipped OFX transaction: ${b.replace(/\s+/g, ' ').slice(0, 120)}`,
      });
      continue;
    }
    rows.push({
      date,
      description,
      amount,
      fitid,
      rawText: b.replace(/\s+/g, ' ').trim().slice(0, 500),
    });
  }
  const ledger =
    /<LEDGERBAL>([\s\S]*?)(<\/LEDGERBAL>|<AVAILBAL>|<\/STMTRS>|<\/CCSTMTRS>|$)/i.exec(
      text,
    );
  const tranList = /<BANKTRANLIST>([\s\S]*?)<STMTTRN>/i.exec(text)?.[1] ?? text;
  const meta: StatementMeta = {
    periodStart: ofxDate(ofxField(tranList, 'DTSTART')),
    periodEnd: ofxDate(ofxField(tranList, 'DTEND')),
    closingBalance: ledgerBalance(
      ledger ? parseAmount(ofxField(ledger[1], 'BALAMT')) : null,
      accountType,
    ),
    openingBalance: null,
  };
  return { rows, issues, meta };
}

/** Card LEDGERBAL is negative when money is owed; reconciliation wants the amount owed as a positive number. */
function ledgerBalance(v: number | null, accountType: string): number | null {
  if (v === null) return null;
  return isCardAccount(accountType) ? -v : v;
}

export class OfxStatementParser implements StatementParser {
  readonly method = 'ofx' as const;
  supports(t: FileType): boolean {
    return t === 'ofx' || t === 'qfx';
  }
  parse(input: ParserInput): Promise<ParseResult | null> {
    const r = parseOfx(input.text, input.ctx.accountType);
    return Promise.resolve({
      method: 'ofx',
      signs: 'normalized',
      rows: r.rows,
      issues: r.issues,
      meta: r.meta,
    });
  }
}
