import {
  BudgetSummary,
  Category,
  Insight,
  Job,
  MonthSummary,
  StatementFile,
  Transaction,
} from '../app/core/models';

export function makeJob(over: Partial<Job> = {}): Job {
  return {
    id: 1,
    type: 'process_month',
    month: '2024-01',
    mode: 'incremental',
    status: 'running',
    total: 10,
    processed: 0,
    inserted: 0,
    skippedDuplicates: 0,
    categorized: 0,
    message: null,
    errors: [],
    startedAt: null,
    finishedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    ...over,
  };
}

export function makeTx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    date: '2024-01-05',
    description: 'COFFEE SHOP',
    amount: -4.5,
    accountId: 1,
    accountName: 'Main Checking',
    categoryId: null,
    categoryName: null,
    categorizedBy: null,
    isManualCorrection: false,
    statementMonth: '2024-01',
    splits: [],
    ...over,
  };
}

export function makeCategory(over: Partial<Category> = {}): Category {
  return {
    id: 1,
    name: 'Food',
    budgetLimit: 400,
    isIncome: false,
    isTransfer: false,
    isAiSuggested: false,
    transactionCount: 0,
    ...over,
  };
}

export function makeMonth(month: string, over: Partial<MonthSummary> = {}): MonthSummary {
  return { month, fileCount: 1, transactionCount: 10, uncategorizedCount: 0, lastProcessedAt: null, ...over };
}

export function makeFile(over: Partial<StatementFile> = {}): StatementFile {
  return {
    id: 1,
    month: '2024-01',
    fileName: 'Main_Checking_2024-01.pdf',
    fileType: 'pdf',
    accountId: 1,
    accountName: 'Main Checking',
    sizeBytes: 2048,
    uploadedAt: '2024-01-31T00:00:00Z',
    lastProcessedAt: null,
    lastParseMethod: null,
    transactionCount: 0,
    ...over,
  };
}

export function makeSummary(over: Partial<BudgetSummary> = {}): BudgetSummary {
  return {
    month: '2024-01',
    totalIncome: 3000,
    totalSpent: 1200,
    net: 1800,
    categories: [
      { categoryId: 1, name: 'Food', budgetLimit: 400, spent: 350, remaining: 50, percentUsed: 87.5, isIncome: false },
      { categoryId: 2, name: 'Housing', budgetLimit: 1000, spent: 850, remaining: 150, percentUsed: 85, isIncome: false },
      { categoryId: 9, name: 'Transfer', budgetLimit: 0, spent: 500, remaining: 0, percentUsed: null, isIncome: false, isTransfer: true },
      { categoryId: 6, name: 'Income', budgetLimit: 0, spent: 3000, remaining: 0, percentUsed: null, isIncome: true, isTransfer: false },
    ],
    uncategorizedSpent: 0,
    ...over,
  };
}

export function makeInsight(over: Partial<Insight> = {}): Insight {
  return {
    id: 1,
    month: '2024-01',
    summary: 'You spent less on food.',
    suggestions: [{ categoryId: 1, categoryName: 'Food', suggestedLimit: 350, reason: 'Consistently under' }],
    model: 'gemma4',
    createdAt: '2024-02-01T00:00:00Z',
    ...over,
  };
}
