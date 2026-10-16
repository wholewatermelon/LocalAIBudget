import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { CategoryAccessService } from '../categories/category-access.service';
import { monthRange } from '../common/month';
import { DbService, num, numOrNull } from '../db/db.service';
import { validateSplits } from './split-validation';

export interface TransactionSplit {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  amount: number;
}

export interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  accountId: number | null;
  accountName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categorizedBy: string | null;
  isManualCorrection: boolean;
  statementMonth: string | null;
  splits: TransactionSplit[];
  transferPairId: number | null;
  transferPairAccountName: string | null;
  aiConfidence: number | null;
  needsReview: boolean;
}

export interface TransactionFilter {
  month?: string;
  accountId?: number;
  categoryId?: number;
  uncategorized?: boolean;
  needsReview?: boolean;
  search?: string;
}

export const TRANSACTION_SELECT = `
  SELECT t.*, a.account_name, c.name AS category_name, pa.account_name AS pair_account_name,
    COALESCE((SELECT json_agg(json_build_object('id', s.id, 'categoryId', s.category_id, 'categoryName', sc.name,
                'amount', s.amount) ORDER BY s.id)
              FROM transaction_splits s LEFT JOIN categories sc ON sc.id = s.category_id
              WHERE s.transaction_id = t.id), '[]'::json) AS splits
  FROM transactions t
  LEFT JOIN accounts a ON a.id = t.account_id
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN transactions p ON p.id = t.transfer_pair_id
  LEFT JOIN accounts pa ON pa.id = p.account_id`;

export function toTransaction(r: any): Transaction {
  return {
    id: r.id,
    date: r.transaction_date,
    description: r.description,
    amount: num(r.amount),
    accountId: r.account_id,
    accountName: r.account_name ?? null,
    categoryId: r.category_id,
    categoryName: r.category_name ?? null,
    categorizedBy: r.categorized_by ?? null,
    isManualCorrection: !!r.is_manual_correction,
    statementMonth: r.statement_month ?? null,
    splits: ((r.splits ?? []) as any[]).map((s) => ({
      id: s.id,
      categoryId: s.categoryId,
      categoryName: s.categoryName,
      amount: num(s.amount),
    })),
    transferPairId: r.transfer_pair_id ?? null,
    transferPairAccountName: r.pair_account_name ?? null,
    aiConfidence: numOrNull(r.ai_confidence),
    needsReview: !!r.needs_review,
  };
}

/** Escapes LIKE wildcards in user input. */
export function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (m) => '\\' + m);
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly db: DbService,
    private readonly categories: CategoriesService,
    private readonly access: CategoryAccessService,
  ) {}

  /** Category-scoped read: always goes through CategoryAccessService. */
  async list(f: TransactionFilter): Promise<Transaction[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const p = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    if (f.month) {
      const { start, end } = monthRange(f.month);
      where.push(
        `t.transaction_date >= ${p(start)}::date AND t.transaction_date < ${p(end)}::date`,
      );
    }
    if (f.accountId !== undefined)
      where.push(`t.account_id = ${p(f.accountId)}`);
    // uncategorized=true ignores categoryId (ARCHITECTURE.md F.5)
    if (f.categoryId !== undefined && !f.uncategorized) {
      const c = p(f.categoryId);
      where.push(
        `(t.category_id = ${c} OR EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id AND s.category_id = ${c}))`,
      );
    }
    if (f.uncategorized) {
      where.push(
        `t.category_id IS NULL AND NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id)`,
      );
    }
    if (f.needsReview) where.push('t.needs_review');
    if (f.search?.trim())
      where.push(
        `t.description ILIKE ${p('%' + likeEscape(f.search.trim()) + '%')}`,
      );
    const visible = await this.access.visibleCategoryIds();
    if (visible) {
      const v = p(visible);
      where.push(
        `(t.category_id = ANY(${v}) OR EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id AND s.category_id = ANY(${v})))`,
      );
    }
    const sql = `${TRANSACTION_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.transaction_date DESC, t.id DESC`;
    return (await this.db.query(sql, params)).map(toTransaction);
  }

  /** Rows matching a raw WHERE clause over alias `t` (internal use, e.g. rule preview). */
  async findWhere(
    whereSql: string,
    params: unknown[],
    limit?: number,
  ): Promise<Transaction[]> {
    const lim = limit ? `LIMIT ${Math.floor(limit)}` : '';
    const sql = `${TRANSACTION_SELECT} WHERE ${whereSql} ORDER BY t.transaction_date DESC, t.id DESC ${lim}`;
    return (await this.db.query(sql, params)).map(toTransaction);
  }

  async get(id: number): Promise<Transaction> {
    const r = await this.db.one(`${TRANSACTION_SELECT} WHERE t.id = $1`, [id]);
    if (!r) throw new NotFoundException(`Transaction ${id} not found`);
    return toTransaction(r);
  }

  /**
   * PATCH: `categoryId` (number|null) → manual correction (also clears needs_review);
   * `reviewed: true` alone → only clears needs_review.
   */
  async update(
    id: number,
    dto: { categoryId?: number | null; reviewed?: boolean },
  ): Promise<Transaction> {
    await this.get(id);
    const hasCategory = dto.categoryId !== undefined;
    if (!hasCategory && !dto.reviewed) {
      throw new BadRequestException(
        'Provide categoryId (number|null) and/or reviewed: true',
      );
    }
    if (hasCategory) {
      if (dto.categoryId !== null)
        await this.categories.assertExists([dto.categoryId as number]);
      await this.db.query(
        `UPDATE transactions SET category_id = $2, is_manual_correction = true, categorized_by = 'manual',
           needs_review = false, updated_at = now() WHERE id = $1`,
        [id, dto.categoryId],
      );
    } else {
      await this.db.query(
        'UPDATE transactions SET needs_review = false, updated_at = now() WHERE id = $1',
        [id],
      );
    }
    return this.get(id);
  }

  /** Bulk "looks good". */
  async markReviewed(ids: number[]): Promise<{ updated: number }> {
    const rows = await this.db.query(
      'UPDATE transactions SET needs_review = false, updated_at = now() WHERE id = ANY($1::int[]) AND needs_review RETURNING id',
      [ids],
    );
    return { updated: rows.length };
  }

  async setSplits(
    id: number,
    splits: { categoryId: number; amount: number }[],
  ): Promise<Transaction> {
    const tx = await this.get(id);
    const err = validateSplits(tx.amount, splits);
    if (err) throw new BadRequestException(err);
    await this.categories.assertExists(splits.map((s) => s.categoryId));
    await this.db.tx(async (c) => {
      await c.query(
        'DELETE FROM transaction_splits WHERE transaction_id = $1',
        [id],
      );
      for (const s of splits) {
        await c.query(
          'INSERT INTO transaction_splits (transaction_id, category_id, amount) VALUES ($1, $2, $3)',
          [id, s.categoryId, s.amount],
        );
      }
      if (splits.length) {
        await c.query(
          `UPDATE transactions SET is_manual_correction = true, categorized_by = 'manual', needs_review = false,
             updated_at = now() WHERE id = $1`,
          [id],
        );
      } else {
        await c.query(
          'UPDATE transactions SET updated_at = now() WHERE id = $1',
          [id],
        );
      }
    });
    return this.get(id);
  }
}
