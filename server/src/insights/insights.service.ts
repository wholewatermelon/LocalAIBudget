import {
  BadGatewayException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BudgetService } from '../budget/budget.service';
import { CategoriesService } from '../categories/categories.service';
import { round2 } from '../common/month';
import { DbService, iso } from '../db/db.service';
import {
  LLM_CLIENT,
  LlmResponseError,
  LlmTimeoutError,
  LlmUnavailableError,
} from '../llm/llm-client';
import type { LlmClient } from '../llm/llm-client';

export interface InsightSuggestion {
  categoryId: number;
  categoryName: string;
  suggestedLimit: number;
  reason: string;
}

export interface Insight {
  id: number;
  month: string;
  summary: string;
  suggestions: InsightSuggestion[];
  model: string | null;
  createdAt: string | null;
}

const toInsight = (r: any): Insight => ({
  id: r.id,
  month: r.month,
  summary: r.summary,
  suggestions: r.suggestions ?? [],
  model: r.model,
  createdAt: iso(r.created_at),
});

/** Validates the model's answer; unknown category names (and transfer/hidden ones) are dropped. */
export function interpretInsightResponse(
  raw: unknown,
  categories: { id: number; name: string }[],
): { summary: string; suggestions: InsightSuggestion[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { summary?: unknown; suggestions?: unknown };
  if (typeof o.summary !== 'string' || !o.summary.trim()) return null;
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
  const suggestions: InsightSuggestion[] = [];
  const seen = new Set<number>();
  for (const s of Array.isArray(o.suggestions) ? o.suggestions : []) {
    if (!s || typeof s !== 'object') continue;
    const x = s as {
      categoryName?: unknown;
      suggestedLimit?: unknown;
      reason?: unknown;
    };
    const cat =
      typeof x.categoryName === 'string'
        ? byName.get(x.categoryName.trim().toLowerCase())
        : undefined;
    const limit =
      typeof x.suggestedLimit === 'number'
        ? x.suggestedLimit
        : Number(x.suggestedLimit);
    if (!cat || !Number.isFinite(limit) || limit < 0 || seen.has(cat.id))
      continue;
    seen.add(cat.id);
    suggestions.push({
      categoryId: cat.id,
      categoryName: cat.name,
      suggestedLimit: round2(limit),
      reason: typeof x.reason === 'string' ? x.reason.trim() : '',
    });
  }
  return { summary: o.summary.trim(), suggestions };
}

@Injectable()
export class InsightsService {
  constructor(
    private readonly db: DbService,
    private readonly budget: BudgetService,
    private readonly categories: CategoriesService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
  ) {}

  async latest(month: string): Promise<Insight | null> {
    const r = await this.db.one(
      'SELECT * FROM ai_insights WHERE month = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
      [month],
    );
    return r ? toInsight(r) : null;
  }

  async generate(month: string): Promise<Insight> {
    // Category-scoped: only visible categories (CategoriesService/BudgetService apply CategoryAccessService).
    const cats = (await this.categories.list()).filter((c) => !c.isTransfer);
    const trend = await this.budget.trend(6, month);
    const current = await this.budget.summary(month);
    const prompt = `You are a helpful household budgeting assistant. Amounts are in dollars.
Monthly history (oldest first; byCategory = amount spent per category):
${JSON.stringify(trend)}

Selected month ${month}: income ${current.totalIncome}, spent ${current.totalSpent}, uncategorized spending ${current.uncategorizedSpent}.
Current monthly budget limits (0 = no limit set):
${JSON.stringify(cats.filter((c) => !c.isIncome).map((c) => ({ categoryName: c.name, limit: c.budgetLimit })))}

Write a short, friendly summary (2-4 sentences) of the spending in ${month} versus previous months, then suggest realistic
monthly limits for spending categories. Use only these category names: ${cats
      .filter((c) => !c.isIncome)
      .map((c) => c.name)
      .join(', ')}.
Return JSON: {"summary": "<text>", "suggestions": [{"categoryName": "<name>", "suggestedLimit": <number>, "reason": "<short reason>"}]}`;
    let raw: unknown;
    try {
      raw = await this.llm.generateJson({ task: 'insights', prompt });
    } catch (err) {
      if (err instanceof LlmUnavailableError)
        throw new ServiceUnavailableException(err.message);
      if (err instanceof LlmTimeoutError)
        throw new GatewayTimeoutException(
          `Generating insights took too long. ${err.message}`,
        );
      if (err instanceof LlmResponseError)
        throw new BadGatewayException(err.message);
      throw err;
    }
    const parsed = interpretInsightResponse(
      raw,
      cats.filter((c) => !c.isIncome),
    );
    if (!parsed)
      throw new BadGatewayException(
        'The model did not return a usable summary. Try again.',
      );
    const r = await this.db.one(
      'INSERT INTO ai_insights (month, summary, suggestions, model) VALUES ($1, $2, $3::jsonb, $4) RETURNING *',
      [
        month,
        parsed.summary,
        JSON.stringify(parsed.suggestions),
        this.llm.model,
      ],
    );
    return toInsight(r);
  }
}
