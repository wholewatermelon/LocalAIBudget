import { Injectable, Logger } from '@nestjs/common';
import { monthRange } from '../common/month';
import { DbService, num } from '../db/db.service';
import { LlmUnavailableError } from '../llm/llm-client';
import { ParseContext } from '../parsing/parse.types';
import { reconcile } from '../parsing/reconciliation';
import { StatementParserService } from '../parsing/statement-parser.service';
import { RulesService } from '../rules/rules.service';
import { selectFilesToProcess } from '../statements/file-naming';
import {
  StatementFile,
  StatementsService,
} from '../statements/statements.service';
import {
  CategorizerService,
  CategorizeResult,
  REVIEW_CONFIDENCE_THRESHOLD,
} from './categorizer.service';
import { computeDedupeKeys } from './dedupe';
import { findTransferPairs, TRANSFER_RE } from './transfers';

export type ProcessMode = 'incremental' | 'recategorize';

export interface JobError {
  file?: string;
  line?: number;
  message: string;
}

export interface JobCounters {
  total: number;
  processed: number;
  inserted: number;
  skippedDuplicates: number;
  categorized: number;
  rulesApplied: number;
  transfersMatched: number;
  errors: JobError[];
}

export interface ProgressSink {
  counters: JobCounters;
  flush(): Promise<void>;
}

const MAX_ISSUES_PER_FILE = 20;

export interface CategorizeOutcome {
  /** Rows categorized by Gemma in this run (counted explicitly, not derived). */
  aiCategorized: number;
  /** Rows left uncategorized for review after repeated LLM timeouts. */
  leftForReview: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** e.g. "Processed 1 file: 13 new rows — 8 by rules, 1 transfer pair, 4 by Gemma (0 duplicates skipped)" */
export function completionMessage(
  files: number,
  c: JobCounters,
  o: CategorizeOutcome,
): string {
  const review = o.leftForReview
    ? `, ${o.leftForReview} left for review (LLM timeout)`
    : '';
  return (
    `Processed ${plural(files, 'file')}: ${plural(c.inserted, 'new row')} — ${c.rulesApplied} by rules, ` +
    `${plural(c.transfersMatched, 'transfer pair')}, ${o.aiCategorized} by Gemma${review} ` +
    `(${plural(c.skippedDuplicates, 'duplicate')} skipped)`
  );
}

/**
 * The month pipeline: import files (parse → sign-normalize → dedupe insert → reconcile), then categorize every
 * eligible row with rules → transfer matching → Gemma. Manual corrections and split rows are never touched.
 */
@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    private readonly db: DbService,
    private readonly statements: StatementsService,
    private readonly parser: StatementParserService,
    private readonly categorizer: CategorizerService,
    private readonly rules: RulesService,
  ) {}

  async processMonth(
    month: string,
    mode: ProcessMode,
    sink: ProgressSink,
  ): Promise<string> {
    const c = sink.counters;
    const files = selectFilesToProcess(await this.statements.syncMonth(month));
    // Progress units = files + rows sent to Gemma. The row count is only known after import, so files are
    // not counted as processed until then: processed/total only ever grows and never exceeds 100%.
    c.total = files.length;
    c.processed = 0;
    await sink.flush();

    for (const file of files) {
      try {
        await this.importFile(file, c);
      } catch (err) {
        if (err instanceof LlmUnavailableError) throw err;
        c.errors.push({ file: file.fileName, message: (err as Error).message });
      }
      await sink.flush();
    }

    const outcome = await this.categorizeMonth(month, mode, sink, files.length);
    return completionMessage(files.length, c, outcome);
  }

  private async importFile(file: StatementFile, c: JobCounters): Promise<void> {
    const ctx: ParseContext = {
      fileName: file.fileName,
      fileType: file.fileType,
      month: file.month,
      accountType: file.accountType ?? 'Bank',
    };
    const result = await this.parser.parseFile(
      this.statements.filePath(file),
      ctx,
    );
    for (const issue of result.issues.slice(0, MAX_ISSUES_PER_FILE)) {
      c.errors.push({
        file: file.fileName,
        ...(issue.line ? { line: issue.line } : {}),
        message: issue.message,
      });
    }
    const accountId = file.accountId as number;
    const keys = computeDedupeKeys(accountId, result.rows);
    await this.db.tx(async (client) => {
      for (const [i, row] of result.rows.entries()) {
        const res = await client.query(
          `INSERT INTO transactions (account_id, transaction_date, description, amount, raw_text, statement_month,
             statement_file_id, dedupe_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
          [
            accountId,
            row.date,
            row.description,
            row.amount,
            row.rawText ?? null,
            file.month,
            file.id,
            keys[i],
          ],
        );
        if (res.rowCount) c.inserted++;
        else c.skippedDuplicates++;
      }
    });
    const meta = result.meta ?? {};
    const rec = reconcile(
      result.rows.map((r) => r.amount),
      meta.openingBalance,
      meta.closingBalance,
      ctx.accountType,
    );
    await this.statements.markProcessed(file.id, result.method, {
      periodStart: meta.periodStart ?? null,
      periodEnd: meta.periodEnd ?? null,
      openingBalance: meta.openingBalance ?? null,
      closingBalance: meta.closingBalance ?? null,
      parsedTotal: rec.parsedTotal,
      status: rec.status,
      diff: rec.diff,
    });
    if (rec.status === 'mismatch') {
      c.errors.push({
        file: file.fileName,
        message: `Reconciliation mismatch: off by $${Math.abs(rec.diff ?? 0).toFixed(2)} — rows may be missing`,
      });
    }
  }

  /** Rows that belong to the month: imported from its folder OR dated in it. */
  private scopeSql(month: string): { sql: string; params: unknown[] } {
    const { start, end } = monthRange(month);
    return {
      sql: `(t.statement_month = $1 OR (t.transaction_date >= $2::date AND t.transaction_date < $3::date))`,
      params: [month, start, end],
    };
  }

  async categorizeMonth(
    month: string,
    mode: ProcessMode,
    sink: ProgressSink,
    importedFiles = 0,
  ): Promise<CategorizeOutcome> {
    const outcome: CategorizeOutcome = { aiCategorized: 0, leftForReview: 0 };
    const c = sink.counters;
    const scope = this.scopeSql(month);
    const targets = await this.db.query<{
      id: number;
      description: string;
      amount: string;
      account_type: string | null;
      transfer_pair_id: number | null;
    }>(
      `SELECT t.id, t.description, t.amount, a.account_type, t.transfer_pair_id
       FROM transactions t LEFT JOIN accounts a ON a.id = t.account_id
       WHERE ${scope.sql} AND NOT COALESCE(t.is_manual_correction, false)
         AND NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id)
         ${mode === 'incremental' ? 'AND t.category_id IS NULL' : ''}
       ORDER BY t.transaction_date, t.id`,
      scope.params,
    );
    const cats = await this.db.query<{
      id: number;
      name: string;
      is_income: boolean;
      is_transfer: boolean;
    }>('SELECT id, name, is_income, is_transfer FROM categories ORDER BY name');
    const catId = new Map(cats.map((x) => [x.name, x.id]));
    const transferCat = cats.find((x) => x.is_transfer) ?? null;
    const done = new Set<number>();

    // 1) Rules
    const match = await this.rules.matcher();
    const hits = new Map<number, number>();
    for (const t of targets) {
      const rule = match(t.description);
      if (!rule) continue;
      await this.db.query(
        `UPDATE transactions SET category_id = $2, categorized_by = 'rule', ai_confidence = NULL, needs_review = false,
           updated_at = now() WHERE id = $1`,
        [t.id, rule.categoryId],
      );
      hits.set(rule.id, (hits.get(rule.id) ?? 0) + 1);
      done.add(t.id);
      c.rulesApplied++;
      c.categorized++;
    }
    await this.rules.addHits(hits);

    // 2) Transfer matching across accounts
    const paired = await this.matchTransfers(month, transferCat?.id ?? null, c);
    for (const t of targets) {
      if (paired.has(t.id) || t.transfer_pair_id !== null) {
        if (!done.has(t.id) && transferCat) {
          await this.db.query(
            `UPDATE transactions SET category_id = $2, categorized_by = 'transfer', ai_confidence = NULL,
               needs_review = false, updated_at = now() WHERE id = $1 AND categorized_by IS DISTINCT FROM 'transfer'`,
            [t.id, transferCat.id],
          );
          if (!paired.has(t.id)) c.categorized++; // re-categorized existing pair (paired ones counted in matchTransfers)
        }
        done.add(t.id);
      }
    }
    await sink.flush();

    // 3) Gemma for the rest
    const remaining = targets.filter((t) => !done.has(t.id));
    c.total = importedFiles + remaining.length;
    c.processed = importedFiles;
    await sink.flush();
    if (!remaining.length) return outcome;
    const examples = await this.recentCorrections();
    const transferLooking = new Set(
      remaining.filter((t) => TRANSFER_RE.test(t.description)).map((t) => t.id),
    );
    await this.categorizer.categorize(
      remaining.map((t) => ({
        id: t.id,
        description: t.description,
        amount: num(t.amount),
        accountType: t.account_type,
      })),
      cats.map((x) => ({
        name: x.name,
        isIncome: x.is_income,
        isTransfer: x.is_transfer,
      })),
      examples,
      async (results: Map<number, CategorizeResult>) => {
        for (const [id, r] of results) {
          // Unpaired transfer-looking rows need review only if the model also calls them a Transfer — utilities
          // like "CASCADE POWER & LIGHT ONLINE PMT" or "INTEREST PAYMENT" match the keywords but aren't transfers.
          const unpairedTransfer =
            transferLooking.has(id) && r.category === transferCat?.name;
          const needsReview =
            r.fallback ||
            r.confidence < REVIEW_CONFIDENCE_THRESHOLD ||
            unpairedTransfer;
          const updated = await this.db.query(
            `UPDATE transactions SET category_id = $2, categorized_by = 'ai', ai_confidence = $3, needs_review = $4,
               updated_at = now()
             WHERE id = $1 AND NOT COALESCE(is_manual_correction, false)
               AND NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = $1) RETURNING id`,
            [
              id,
              catId.get(r.category) ?? null,
              Math.round(r.confidence * 100) / 100,
              needsReview,
            ],
          );
          if (updated.length) {
            c.categorized++;
            outcome.aiCategorized++;
          }
        }
        c.processed += results.size;
        await sink.flush();
      },
      async (batch, err) => {
        // Timed out twice: leave the rows as they are (uncategorized in incremental mode) and queue them for review.
        await this.db.query(
          `UPDATE transactions SET needs_review = true, updated_at = now()
           WHERE id = ANY($1::int[]) AND NOT COALESCE(is_manual_correction, false)`,
          [batch.map((b) => b.id)],
        );
        c.errors.push({
          message: `Categorization timed out twice for ${batch.length} row(s); they were left for review. ${err.message}`,
        });
        outcome.leftForReview += batch.length;
        c.processed += batch.length;
        await sink.flush();
      },
    );
    return outcome;
  }

  /**
   * Pairs unpaired rows in/around the month (±5 days). Paired rows that are not manual/split/rule-categorized
   * get the Transfer category. Returns the ids that were paired in this run.
   */
  private async matchTransfers(
    month: string,
    transferCategoryId: number | null,
    c: JobCounters,
  ): Promise<Set<number>> {
    const { start, end } = monthRange(month);
    const pool = await this.db.query(
      `SELECT t.id, t.account_id, t.transaction_date, t.amount, t.description, COALESCE(cat.is_transfer, false) AS is_transfer
       FROM transactions t LEFT JOIN categories cat ON cat.id = t.category_id
       WHERE t.transfer_pair_id IS NULL
         AND ((t.transaction_date >= $1::date - 5 AND t.transaction_date < $2::date + 5) OR t.statement_month = $3)`,
      [start, end, month],
    );
    const pairs = findTransferPairs(
      pool.map((r) => ({
        id: r.id,
        accountId: r.account_id,
        date: r.transaction_date,
        amount: num(r.amount),
        description: r.description,
        categoryIsTransfer: r.is_transfer,
      })),
    );
    const paired = new Set<number>();
    for (const [a, b] of pairs) {
      await this.db.query(
        'UPDATE transactions SET transfer_pair_id = $2 WHERE id = $1',
        [a, b],
      );
      await this.db.query(
        'UPDATE transactions SET transfer_pair_id = $2 WHERE id = $1',
        [b, a],
      );
      paired.add(a);
      paired.add(b);
      c.transfersMatched++;
      if (transferCategoryId === null) continue;
      const updated = await this.db.query(
        `UPDATE transactions t SET category_id = $2, categorized_by = 'transfer', ai_confidence = NULL, needs_review = false,
           updated_at = now()
         WHERE t.id = ANY($1::int[]) AND NOT COALESCE(t.is_manual_correction, false)
           AND t.categorized_by IS DISTINCT FROM 'rule'
           AND NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id) RETURNING t.id`,
        [[a, b], transferCategoryId],
      );
      c.categorized += updated.length;
    }
    if (pairs.length)
      this.logger.log(`${month}: matched ${pairs.length} transfer pair(s)`);
    return paired;
  }

  /** Up to 20 most recent manual corrections, as few-shot examples. */
  private async recentCorrections(): Promise<
    { description: string; category: string }[]
  > {
    const rows = await this.db.query<{ description: string; name: string }>(
      `SELECT DISTINCT ON (upper(t.description)) t.description, c.name, t.updated_at
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.is_manual_correction AND t.categorized_by = 'manual'
         AND NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id)
       ORDER BY upper(t.description), t.updated_at DESC`,
    );
    return rows
      .sort(
        (a: any, b: any) => +new Date(b.updated_at) - +new Date(a.updated_at),
      )
      .slice(0, 20)
      .map((r) => ({ description: r.description, category: r.name }));
  }
}
