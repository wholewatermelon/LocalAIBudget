import { computeBudgetSummary } from './budget-math';

const cats = [
  { id: 1, name: 'Food', budgetLimit: 200, isIncome: false, isTransfer: false },
  {
    id: 2,
    name: 'Housing',
    budgetLimit: 1000,
    isIncome: false,
    isTransfer: false,
  },
  { id: 3, name: 'Income', budgetLimit: 0, isIncome: true, isTransfer: false },
  {
    id: 4,
    name: 'Transfer',
    budgetLimit: 0,
    isIncome: false,
    isTransfer: true,
  },
  { id: 5, name: 'Other', budgetLimit: 0, isIncome: false, isTransfer: false },
];

describe('computeBudgetSummary', () => {
  const flows = [
    { categoryId: 1, positive: 10, negative: -250.5 }, // a refund + spending
    { categoryId: 2, positive: 0, negative: -900 },
    { categoryId: 3, positive: 3000, negative: 0 },
    { categoryId: 4, positive: 1850, negative: -1850 }, // card payment pair — excluded
    { categoryId: null, positive: 0, negative: -40.25 },
  ];

  it('computes totals excluding transfers, per-category spent/remaining/percent, income last', () => {
    const s = computeBudgetSummary('2024-12', cats, flows);
    expect(s.totalIncome).toBe(3010);
    expect(s.totalSpent).toBe(1190.75);
    expect(s.net).toBe(1819.25);
    expect(s.uncategorizedSpent).toBe(40.25);
    expect(s.categories.map((c) => c.name)).toEqual([
      'Housing',
      'Food',
      'Other',
      'Income',
      'Transfer',
    ]);
    expect(s.categories.find((c) => c.name === 'Food')).toEqual({
      categoryId: 1,
      name: 'Food',
      budgetLimit: 200,
      spent: 250.5,
      remaining: -50.5,
      percentUsed: 125.3,
      isIncome: false,
      isTransfer: false,
    });
    expect(s.categories.find((c) => c.name === 'Income')!.spent).toBe(3000);
    expect(
      s.categories.find((c) => c.name === 'Other')!.percentUsed,
    ).toBeNull();
    // Transfer is listed (flagged) but excluded from totals.
    expect(s.categories.find((c) => c.name === 'Transfer')).toMatchObject({
      isTransfer: true,
      spent: 1850,
    });
  });

  it('restricts everything to visible categories (future per-person visibility)', () => {
    const s = computeBudgetSummary('2024-12', cats, flows, [1]);
    expect(s.categories.map((c) => c.name)).toEqual(['Food']);
    expect(s.totalSpent).toBe(250.5);
    expect(s.totalIncome).toBe(10);
    expect(s.uncategorizedSpent).toBe(0);
  });

  it('handles an empty month', () => {
    const s = computeBudgetSummary('2030-01', cats, []);
    expect([s.totalIncome, s.totalSpent, s.net, s.uncategorizedSpent]).toEqual([
      0, 0, 0, 0,
    ]);
    expect(s.categories).toHaveLength(5);
  });
});
