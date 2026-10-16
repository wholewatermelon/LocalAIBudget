import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { DbService, pgCode, PG_UNIQUE_VIOLATION } from '../db/db.service';
import {
  Transaction,
  TransactionsService,
} from '../transactions/transactions.service';
import {
  compileRegex,
  deriveMerchantKey,
  findMatchingRule,
  MatchType,
  ruleMatches,
  RuleLike,
} from './rule-matching';

export interface Rule extends RuleLike {
  categoryName: string;
  hits: number;
}

export interface RuleInput {
  pattern: string;
  matchType?: MatchType;
  categoryId: number;
  priority?: number;
}

const SELECT = `SELECT r.*, c.name AS category_name FROM category_rules r JOIN categories c ON c.id = r.category_id`;

const toRule = (r: any): Rule => ({
  id: r.id,
  pattern: r.pattern,
  matchType: r.match_type,
  categoryId: r.category_id,
  categoryName: r.category_name,
  priority: r.priority,
  hits: r.hits,
});

@Injectable()
export class RulesService {
  constructor(
    private readonly db: DbService,
    private readonly categories: CategoriesService,
    private readonly transactions: TransactionsService,
  ) {}

  async list(): Promise<Rule[]> {
    return (
      await this.db.query(
        `${SELECT} ORDER BY r.priority DESC, length(r.pattern) DESC, r.id`,
      )
    ).map(toRule);
  }

  async get(id: number): Promise<Rule> {
    const r = await this.db.one(`${SELECT} WHERE r.id = $1`, [id]);
    if (!r) throw new NotFoundException(`Rule ${id} not found`);
    return toRule(r);
  }

  private validatePattern(pattern: string, matchType: MatchType): void {
    if (!pattern.trim())
      throw new BadRequestException('pattern must not be empty');
    if (matchType === 'regex') {
      try {
        compileRegex(pattern);
      } catch (e) {
        throw new BadRequestException(`Invalid regex: ${(e as Error).message}`);
      }
    }
  }

  async create(
    input: RuleInput & { applyToExisting?: boolean },
  ): Promise<Rule & { appliedCount?: number }> {
    const matchType = input.matchType ?? 'contains';
    const pattern = input.pattern.trim();
    this.validatePattern(pattern, matchType);
    await this.categories.assertExists([input.categoryId]);
    let id: number;
    try {
      const r = await this.db.one<{ id: number }>(
        `INSERT INTO category_rules (pattern, match_type, category_id, priority) VALUES ($1, $2, $3, $4) RETURNING id`,
        [pattern, matchType, input.categoryId, input.priority ?? 0],
      );
      id = r!.id;
    } catch (err) {
      if (pgCode(err) === PG_UNIQUE_VIOLATION)
        throw new ConflictException(
          `A ${matchType} rule for "${pattern}" already exists`,
        );
      throw err;
    }
    if (!input.applyToExisting) return this.get(id);
    const appliedCount = await this.applyToExisting(id);
    return { ...(await this.get(id)), appliedCount };
  }

  async update(id: number, patch: Partial<RuleInput>): Promise<Rule> {
    const cur = await this.get(id);
    const pattern = patch.pattern?.trim() ?? cur.pattern;
    const matchType = patch.matchType ?? cur.matchType;
    this.validatePattern(pattern, matchType);
    if (patch.categoryId !== undefined)
      await this.categories.assertExists([patch.categoryId]);
    try {
      await this.db.query(
        `UPDATE category_rules SET pattern = $2, match_type = $3, category_id = $4, priority = $5 WHERE id = $1`,
        [
          id,
          pattern,
          matchType,
          patch.categoryId ?? cur.categoryId,
          patch.priority ?? cur.priority,
        ],
      );
    } catch (err) {
      if (pgCode(err) === PG_UNIQUE_VIOLATION)
        throw new ConflictException(
          `A ${matchType} rule for "${pattern}" already exists`,
        );
      throw err;
    }
    return this.get(id);
  }

  async remove(id: number): Promise<void> {
    await this.get(id);
    await this.db.query('DELETE FROM category_rules WHERE id = $1', [id]);
  }

  /** Ids of all transactions whose description matches (JS matching, same semantics as processing). */
  private async matchingIds(
    rule: Pick<RuleLike, 'pattern' | 'matchType'>,
  ): Promise<number[]> {
    const rows = await this.db.query<{ id: number; description: string }>(
      'SELECT t.id, t.description FROM transactions t',
    );
    return rows
      .filter((r) => ruleMatches(rule, r.description))
      .map((r) => r.id);
  }

  async preview(
    pattern: string,
    matchType: MatchType = 'contains',
  ): Promise<{ matchCount: number; sample: Transaction[] }> {
    this.validatePattern(pattern, matchType);
    const ids = await this.matchingIds({ pattern, matchType });
    const sample = ids.length
      ? await this.transactions.findWhere('t.id = ANY($1::int[])', [ids], 10)
      : [];
    return { matchCount: ids.length, sample };
  }

  /**
   * `matchCount` = exactly what `POST /rules { pattern, matchType: 'contains', applyToExisting: true }` (priority 0)
   * would update — computed with the same function as applyToExisting.
   */
  async suggest(
    transactionId: number,
  ): Promise<{ pattern: string; matchType: MatchType; matchCount: number }> {
    const tx = await this.transactions.get(transactionId);
    const pattern = deriveMerchantKey(tx.description);
    const existing = await this.list();
    const candidate: RuleLike = {
      // A newly created rule gets the highest id, so it loses id tie-breaks against existing rules.
      id: Number.MAX_SAFE_INTEGER,
      pattern,
      matchType: 'contains',
      categoryId: 0,
      priority: 0,
    };
    const ids = await this.applicableIds(candidate, [...existing, candidate]);
    return { pattern, matchType: 'contains', matchCount: ids.length };
  }

  /**
   * Rows `rule` would categorize when applied to existing transactions: not manual, not split, not transfer-paired,
   * and `rule` is the winning rule among `allRules` (priority, then longest pattern, then lowest id).
   */
  private async applicableIds(
    rule: RuleLike,
    allRules: RuleLike[],
  ): Promise<number[]> {
    const rows = await this.db.query<{ id: number; description: string }>(
      `SELECT t.id, t.description FROM transactions t
       WHERE NOT COALESCE(t.is_manual_correction, false) AND t.transfer_pair_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id)`,
    );
    return rows
      .filter((r) => findMatchingRule(allRules, r.description)?.id === rule.id)
      .map((r) => r.id);
  }

  /**
   * Applies one rule to existing matching transactions. Skips manual corrections, split rows, transfer-paired rows,
   * and rows where another rule wins (higher priority / longer pattern — same precedence as processing).
   * Returns the count.
   */
  async applyToExisting(ruleId: number): Promise<number> {
    const rule = await this.get(ruleId);
    const ids = await this.applicableIds(rule, await this.list());
    if (!ids.length) return 0;
    await this.db.query(
      `UPDATE transactions SET category_id = $2, categorized_by = 'rule', ai_confidence = NULL, needs_review = false,
         updated_at = now() WHERE id = ANY($1::int[])`,
      [ids, rule.categoryId],
    );
    await this.db.query(
      'UPDATE category_rules SET hits = hits + $2 WHERE id = $1',
      [ruleId, ids.length],
    );
    return ids.length;
  }

  /** Used by processing: best rule per description (or null). */
  async matcher(): Promise<(description: string) => Rule | null> {
    const rules = await this.list();
    return (d: string) => findMatchingRule(rules, d);
  }

  async addHits(hits: Map<number, number>): Promise<void> {
    for (const [id, n] of hits)
      await this.db.query(
        'UPDATE category_rules SET hits = hits + $2 WHERE id = $1',
        [id, n],
      );
  }
}
