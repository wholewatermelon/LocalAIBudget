import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DbService,
  num,
  pgCode,
  PG_FK_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from '../db/db.service';
import { CategoryAccessService } from './category-access.service';

export interface Category {
  id: number;
  name: string;
  budgetLimit: number;
  isIncome: boolean;
  isTransfer: boolean;
  isAiSuggested: boolean;
  transactionCount: number;
}

const SELECT = `
  SELECT c.*,
    (SELECT count(*) FROM transactions t WHERE t.category_id = c.id)
    + (SELECT count(*) FROM transaction_splits s WHERE s.category_id = c.id) AS transaction_count
  FROM categories c`;

function toCategory(r: any): Category {
  return {
    id: r.id,
    name: r.name,
    budgetLimit: num(r.budget_limit),
    isIncome: !!r.is_income,
    isTransfer: !!r.is_transfer,
    isAiSuggested: !!r.is_ai_suggested,
    transactionCount: num(r.transaction_count),
  };
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly db: DbService,
    private readonly access: CategoryAccessService,
  ) {}

  async list(): Promise<Category[]> {
    const visible = await this.access.visibleCategoryIds();
    const rows = await this.db.query(
      `${SELECT} WHERE ($1::int[] IS NULL OR c.id = ANY($1)) ORDER BY c.name`,
      [visible],
    );
    return rows.map(toCategory);
  }

  async get(id: number): Promise<Category> {
    const r = await this.db.one(`${SELECT} WHERE c.id = $1`, [id]);
    if (!r) throw new NotFoundException(`Category ${id} not found`);
    return toCategory(r);
  }

  /** Name → id lookup (case-insensitive) used by the categorizer and insights. */
  async nameIndex(): Promise<Map<string, { id: number; name: string }>> {
    const rows = await this.db.query<{ id: number; name: string }>(
      'SELECT id, name FROM categories',
    );
    return new Map(rows.map((r) => [r.name.toLowerCase(), r]));
  }

  async assertExists(ids: number[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    const rows = await this.db.query(
      'SELECT id FROM categories WHERE id = ANY($1)',
      [unique],
    );
    if (rows.length !== unique.length)
      throw new BadRequestException('Unknown categoryId');
  }

  async create(dto: {
    name: string;
    budgetLimit?: number;
    isIncome?: boolean;
    isTransfer?: boolean;
  }): Promise<Category> {
    try {
      const r = await this.db.one(
        'INSERT INTO categories (name, budget_limit, is_income, is_transfer) VALUES ($1, $2, $3, $4) RETURNING id',
        [
          dto.name.trim(),
          dto.budgetLimit ?? 0,
          dto.isIncome ?? false,
          dto.isTransfer ?? false,
        ],
      );
      return this.get(r!.id);
    } catch (err) {
      if (pgCode(err) === PG_UNIQUE_VIOLATION)
        throw new ConflictException(`Category "${dto.name}" already exists`);
      throw err;
    }
  }

  async update(
    id: number,
    dto: {
      name?: string;
      budgetLimit?: number;
      isIncome?: boolean;
      isTransfer?: boolean;
    },
  ): Promise<Category> {
    await this.get(id);
    try {
      await this.db.query(
        `UPDATE categories SET name = COALESCE($2, name), budget_limit = COALESCE($3, budget_limit),
           is_income = COALESCE($4, is_income), is_transfer = COALESCE($5, is_transfer) WHERE id = $1`,
        [
          id,
          dto.name?.trim() ?? null,
          dto.budgetLimit ?? null,
          dto.isIncome ?? null,
          dto.isTransfer ?? null,
        ],
      );
    } catch (err) {
      if (pgCode(err) === PG_UNIQUE_VIOLATION)
        throw new ConflictException(`Category "${dto.name}" already exists`);
      throw err;
    }
    return this.get(id);
  }

  async remove(id: number): Promise<void> {
    const c = await this.get(id);
    if (c.transactionCount > 0) {
      throw new ConflictException(
        `Category "${c.name}" is used by ${c.transactionCount} transaction(s)/split(s)`,
      );
    }
    try {
      await this.db.query('DELETE FROM categories WHERE id = $1', [id]);
    } catch (err) {
      if (pgCode(err) === PG_FK_VIOLATION)
        throw new ConflictException(`Category "${c.name}" is in use`);
      throw err;
    }
  }
}
