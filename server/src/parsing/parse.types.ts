export type FileType = 'pdf' | 'txt' | 'csv' | 'ofx' | 'qfx';
export type ParseMethod = 'regex' | 'csv' | 'llm' | 'ofx';

/** Optional statement-level metadata used for reconciliation. Balances as printed (card: amount owed). */
export interface StatementMeta {
  periodStart?: string | null;
  periodEnd?: string | null;
  openingBalance?: number | null;
  closingBalance?: number | null;
}

/** A transaction as produced by a parser, already sign-normalized (negative = money out). */
export interface ParsedRow {
  /** Set by parsers; normalized by the service unless ParseResult.signs === 'normalized'. */
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  rawText?: string;
  /** OFX FITID — when present, dedupe uses it instead of the content hash. */
  fitid?: string;
}

export interface ParseIssue {
  line?: number;
  message: string;
}

export interface ParseResult {
  method: ParseMethod;
  /**
   * 'as-printed': amounts carry the file's own sign (a card file may list charges as positive) → the service
   * applies sign normalization. 'normalized': the parser already produced negative = money out.
   */
  signs: 'as-printed' | 'normalized';
  rows: ParsedRow[];
  issues: ParseIssue[];
  meta?: StatementMeta;
}

export interface StatementPeriod {
  start: string; // YYYY-MM-DD
  end: string;
}

export interface ParseContext {
  fileName: string;
  fileType: FileType;
  /** Folder month 'YYYY-MM' (fallback for year inference). */
  month: string;
  accountType: string; // 'Bank' | 'Credit Card' | ...
}

/** Input handed to a strategy: extracted text (pdf/txt) or raw file content (csv). */
export interface ParserInput {
  text: string;
  pages: string[];
  ctx: ParseContext;
}

/** Pluggable parser strategy. Returns null when it doesn't apply / found nothing, so the next strategy runs. */
export interface StatementParser {
  readonly method: ParseMethod;
  supports(fileType: FileType): boolean;
  parse(input: ParserInput): Promise<ParseResult | null>;
}
