import { Inject, Injectable } from '@nestjs/common';
import { LLM_CLIENT } from '../llm/llm-client';
import type { LlmClient } from '../llm/llm-client';
import { CsvStatementParser } from './csv.parser';
import { LlmExtractionParser } from './llm-extraction.parser';
import { OfxStatementParser } from './ofx.parser';
import { ParseContext, ParseResult, StatementParser } from './parse.types';
import { RegexLineParser } from './regex-line.parser';
import {
  RunningBalanceTableParser,
  TwoDateTableParser,
} from './table-layout.parser';
import { normalizeSigns } from './sign-normalization';
import { extractText } from './text-extractor';

/**
 * Runs the parser strategy chain for one file: the first strategy that supports the file type and returns
 * a result wins (ofx/qfx → OfxStatementParser; csv → CsvStatementParser; pdf/txt → legacy regex lines, running-balance table, two-date card table, then LLM extraction). Applies sign normalization.
 */
@Injectable()
export class StatementParserService {
  private readonly parsers: StatementParser[];

  constructor(@Inject(LLM_CLIENT) llm: LlmClient) {
    this.parsers = [
      new OfxStatementParser(),
      new CsvStatementParser(llm),
      new RegexLineParser(),
      new RunningBalanceTableParser(),
      new TwoDateTableParser(),
      new LlmExtractionParser(llm),
    ];
  }

  async parseFile(filePath: string, ctx: ParseContext): Promise<ParseResult> {
    const { text, pages } = await extractText(filePath, ctx.fileType);
    return this.parseText(text, pages, ctx);
  }

  async parseText(
    text: string,
    pages: string[],
    ctx: ParseContext,
  ): Promise<ParseResult> {
    for (const parser of this.parsers) {
      if (!parser.supports(ctx.fileType)) continue;
      const result = await parser.parse({ text, pages, ctx });
      if (!result) continue;
      if (result.signs === 'as-printed') {
        const n = normalizeSigns(result.rows, ctx.accountType);
        return { ...result, rows: n.rows, signs: 'normalized' };
      }
      return result;
    }
    return {
      method:
        ctx.fileType === 'csv'
          ? 'csv'
          : ctx.fileType === 'ofx' || ctx.fileType === 'qfx'
            ? 'ofx'
            : 'regex',
      signs: 'normalized',
      rows: [],
      issues: text.trim()
        ? [{ message: 'No transactions found' }]
        : [{ message: 'File has no extractable text' }],
    };
  }
}
