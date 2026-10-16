// Typed mirror of the REST contract in docs/ARCHITECTURE.md. Keep in sync with it.
// Money: negative = spending, positive = income. Months are 'YYYY-MM' strings.

export type Month = string;

export interface Health {
  db: 'ok' | 'error';
  ollama: 'ok' | 'error';
  model: string;
  modelAvailable: boolean;
}

export interface MonthSummary {
  month: Month;
  fileCount: number;
  transactionCount: number;
  uncategorizedCount: number;
  lastProcessedAt: string | null;
  /** MVP-C: files in this month whose balances don't reconcile. */
  reconciliationIssues?: number;
  /** MVP-E: transactions flagged for review. */
  needsReviewCount?: number;
}

export type FileType = 'pdf' | 'txt' | 'csv' | 'ofx' | 'qfx';
export type ParseMethod = 'regex' | 'csv' | 'llm' | 'ofx';
export type ReconciliationStatus = 'ok' | 'mismatch' | 'unknown';

export interface StatementFile {
  id: number;
  month: Month;
  fileName: string;
  fileType: FileType;
  accountId: number | null;
  accountName: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
  lastProcessedAt: string | null;
  lastParseMethod: ParseMethod | null;
  transactionCount: number;
  // MVP-C reconciliation (optional so older payloads still type-check)
  periodStart?: string | null;
  periodEnd?: string | null;
  openingBalance?: number | null;
  closingBalance?: number | null;
  parsedTotal?: number | null;
  reconciliationStatus?: ReconciliationStatus;
  reconciliationDiff?: number | null;
}

export type JobMode = 'incremental' | 'recategorize';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface JobError {
  file?: string;
  line?: number;
  message: string;
}

export interface Job {
  id: number;
  type: string; // 'process_month'
  month: Month;
  mode: JobMode;
  status: JobStatus;
  total: number;
  processed: number;
  inserted: number;
  skippedDuplicates: number;
  categorized: number;
  /** MVP-B */
  rulesApplied?: number;
  /** MVP-D */
  transfersMatched?: number;
  message: string | null;
  errors: JobError[];
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export type CategorizedBy = 'ai' | 'manual' | 'rule' | 'transfer' | null;

export interface TransactionSplit {
  id: number;
  categoryId: number;
  categoryName: string;
  amount: number;
}

export interface Transaction {
  id: number;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  accountId: number | null;
  accountName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categorizedBy: CategorizedBy;
  isManualCorrection: boolean;
  statementMonth: Month | null;
  splits: TransactionSplit[];
  // MVP-D transfer matching
  transferPairId?: number | null;
  transferPairAccountName?: string | null;
  // MVP-E review queue
  aiConfidence?: number | null;
  needsReview?: boolean;
}

export interface TransactionFilters {
  month?: Month | null;
  accountId?: number | null;
  categoryId?: number | null;
  uncategorized?: boolean;
  search?: string | null;
  needsReview?: boolean;
}

export interface SplitInput {
  categoryId: number;
  amount: number;
}

export interface Category {
  id: number;
  name: string;
  budgetLimit: number;
  isIncome: boolean;
  /** ARCHITECTURE F.2. Optional only for older servers; use `isTransfer()` from category-utils. */
  isTransfer?: boolean;
  isAiSuggested: boolean;
  transactionCount: number;
}

export interface CategoryCreate {
  name: string;
  budgetLimit?: number;
  isIncome?: boolean;
  isTransfer?: boolean;
}

export type CategoryUpdate = Partial<CategoryCreate>;

export interface Account {
  id: number;
  accountName: string;
  accountType: string;
}

export type AccountUpdate = Partial<Pick<Account, 'accountName' | 'accountType'>>;

export interface BudgetCategory {
  categoryId: number;
  name: string;
  budgetLimit: number;
  spent: number;
  remaining: number;
  /** 0-100 scale; null when budgetLimit = 0 (ARCHITECTURE F.1). The UI computes colour from spent/limit. */
  percentUsed: number | null;
  isIncome: boolean;
  /** ARCHITECTURE F.2 */
  isTransfer?: boolean;
}

export interface BudgetSummary {
  month: Month;
  totalIncome: number;
  totalSpent: number;
  net: number;
  categories: BudgetCategory[];
  uncategorizedSpent: number;
}

export interface TrendPoint {
  month: Month;
  totalIncome: number;
  totalSpent: number;
  byCategory: Record<string, number>;
}

export interface InsightSuggestion {
  categoryId: number;
  categoryName: string;
  suggestedLimit: number;
  reason: string;
}

export interface Insight {
  id: number;
  month: Month;
  summary: string;
  suggestions: InsightSuggestion[];
  model: string | null;
  createdAt: string;
}

/** Nest default error body. */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// ---- MVP-B: category rules ----

export type MatchType = 'contains' | 'starts_with' | 'regex';

export interface Rule {
  id: number;
  pattern: string;
  matchType: MatchType;
  categoryId: number;
  categoryName: string;
  priority: number;
  hits: number;
  /** Present on create when applyToExisting was true. */
  appliedCount?: number;
}

export interface RuleCreate {
  pattern: string;
  matchType?: MatchType;
  categoryId: number;
  priority?: number;
  applyToExisting?: boolean;
}

export type RuleUpdate = Partial<Omit<RuleCreate, 'applyToExisting'>>;

export interface RulePreview {
  matchCount: number;
  sample: Transaction[];
}

export interface RuleSuggestion {
  pattern: string;
  matchType: MatchType;
  matchCount: number;
}
