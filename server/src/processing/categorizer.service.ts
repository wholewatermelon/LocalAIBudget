import { Inject, Injectable } from '@nestjs/common';
import {
  LLM_CLIENT,
  LlmResponseError,
  LlmTimeoutError,
} from '../llm/llm-client';
import type { LlmClient } from '../llm/llm-client';

export const CATEGORIZE_BATCH_SIZE = 20;
/** 1 try + 1 retry when a batch times out. */
export const CATEGORIZE_TIMEOUT_ATTEMPTS = 2;
export const REVIEW_CONFIDENCE_THRESHOLD = 0.7;
export const FALLBACK_CATEGORY = 'Other';

export interface CategorizeItem {
  id: number;
  description: string;
  amount: number;
  accountType?: string | null;
}

export interface CategoryOption {
  name: string;
  isIncome?: boolean;
  isTransfer?: boolean;
}

export interface FewShotExample {
  description: string;
  category: string;
}

export interface CategorizeResult {
  /** Canonical category name from the allowed list (or FALLBACK_CATEGORY). */
  category: string;
  confidence: number;
  /** True when the model's answer was missing/invalid and we fell back to Other. */
  fallback: boolean;
}

export function buildCategorizePrompt(
  items: CategorizeItem[],
  categories: CategoryOption[],
  examples: FewShotExample[],
): string {
  const cats = categories
    .map(
      (c) =>
        `- ${c.name}${c.isIncome ? ' (money received: salary, deposits, refunds of income)' : ''}${c.isTransfer ? ' (moving money between own accounts, credit card payments)' : ''}`,
    )
    .join('\n');
  const ex = examples.length
    ? `\nThe user corrected these before — follow the same choices for similar merchants:\n${examples
        .map((e) => `- "${e.description}" → ${e.category}`)
        .join('\n')}\n`
    : '';
  const tx = items.map((i) => ({
    id: i.id,
    description: i.description,
    amount: i.amount,
    ...(i.accountType ? { account: i.accountType } : {}),
  }));
  return `Categorize each bank/credit card transaction into exactly one of these categories:
${cats}
Negative amount = money spent, positive = money received. A positive "PAYMENT" on a credit card account is a Transfer.
${ex}
Transactions:
${JSON.stringify(tx)}

Return JSON: {"results": [{"id": <id>, "category": "<one of the categories above, exact spelling>", "confidence": <0..1>}]} with one entry per transaction.`;
}

/** Maps a raw model answer to results, forcing anything not in the allowed list to Other. */
export function interpretCategorizeResponse(
  raw: unknown,
  items: CategorizeItem[],
  allowed: string[],
): Map<number, CategorizeResult> {
  const canon = new Map(allowed.map((n) => [n.toLowerCase(), n]));
  const fallbackName =
    canon.get(FALLBACK_CATEGORY.toLowerCase()) ?? FALLBACK_CATEGORY;
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === 'object' &&
        Array.isArray((raw as { results?: unknown }).results)
      ? (raw as { results: unknown[] }).results
      : [];
  const byId = new Map<number, { category?: unknown; confidence?: unknown }>();
  list.forEach((r, idx) => {
    if (!r || typeof r !== 'object') return;
    const o = r as { id?: unknown; category?: unknown; confidence?: unknown };
    const id =
      typeof o.id === 'number'
        ? o.id
        : typeof o.id === 'string'
          ? Number(o.id)
          : items[idx]?.id;
    if (id !== undefined && Number.isFinite(id)) byId.set(id, o);
  });
  const out = new Map<number, CategorizeResult>();
  for (const item of items) {
    const ans = byId.get(item.id);
    const name =
      typeof ans?.category === 'string'
        ? canon.get(ans.category.trim().toLowerCase())
        : undefined;
    let confidence =
      typeof ans?.confidence === 'number'
        ? ans.confidence
        : Number(ans?.confidence);
    if (!Number.isFinite(confidence)) confidence = name ? 0.5 : 0;
    confidence = Math.min(1, Math.max(0, confidence));
    out.set(
      item.id,
      name
        ? { category: name, confidence, fallback: false }
        : { category: fallbackName, confidence: 0, fallback: true },
    );
  }
  return out;
}

@Injectable()
export class CategorizerService {
  constructor(@Inject(LLM_CLIENT) private readonly llm: LlmClient) {}

  /**
   * Categorizes items in batches of ≤ 20 LLM calls. `onBatch` is called after each batch with its results
   * (lets the job persist progress incrementally).
   * - unparseable answer → the batch falls back to Other (flagged for review);
   * - timeout → the batch is retried once; a second timeout calls `onBatchTimeout` (if given, else rethrows)
   *   and continues with the next batch — those items get no result;
   * - unreachable LLM → rethrown (the job fails).
   */
  async categorize(
    items: CategorizeItem[],
    categories: CategoryOption[],
    examples: FewShotExample[],
    onBatch?: (results: Map<number, CategorizeResult>) => Promise<void>,
    onBatchTimeout?: (
      batch: CategorizeItem[],
      err: LlmTimeoutError,
    ) => Promise<void>,
  ): Promise<Map<number, CategorizeResult>> {
    const all = new Map<number, CategorizeResult>();
    const allowed = categories.map((c) => c.name);
    for (let i = 0; i < items.length; i += CATEGORIZE_BATCH_SIZE) {
      const batch = items.slice(i, i + CATEGORIZE_BATCH_SIZE);
      const prompt = buildCategorizePrompt(batch, categories, examples);
      let raw: unknown = null;
      let timedOut: LlmTimeoutError | null = null;
      for (let attempt = 1; attempt <= CATEGORIZE_TIMEOUT_ATTEMPTS; attempt++) {
        try {
          raw = await this.llm.generateJson({ task: 'categorize', prompt });
          timedOut = null;
          break;
        } catch (err) {
          if (err instanceof LlmResponseError) break;
          if (!(err instanceof LlmTimeoutError)) throw err;
          timedOut = err;
        }
      }
      if (timedOut) {
        if (!onBatchTimeout) throw timedOut;
        await onBatchTimeout(batch, timedOut);
        continue;
      }
      const results = interpretCategorizeResponse(raw, batch, allowed);
      results.forEach((v, k) => all.set(k, v));
      if (onBatch) await onBatch(results);
    }
    return all;
  }
}
