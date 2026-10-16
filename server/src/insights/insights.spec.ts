import { interpretInsightResponse } from './insights.service';

describe('interpretInsightResponse', () => {
  const cats = [
    { id: 1, name: 'Food' },
    { id: 2, name: 'Housing' },
  ];

  it('maps names to ids case-insensitively and drops unknown/invalid/duplicate suggestions', () => {
    const r = interpretInsightResponse(
      {
        summary: ' Spending was steady. ',
        suggestions: [
          { categoryName: 'food', suggestedLimit: 450.555, reason: 'avg' },
          { categoryName: 'Vacations', suggestedLimit: 100, reason: 'x' },
          { categoryName: 'Housing', suggestedLimit: -5, reason: 'neg' },
          {
            categoryName: 'Housing',
            suggestedLimit: '2400',
            reason: 'mortgage',
          },
          { categoryName: 'Food', suggestedLimit: 1, reason: 'dup' },
          null,
        ],
      },
      cats,
    );
    expect(r).toEqual({
      summary: 'Spending was steady.',
      suggestions: [
        {
          categoryId: 1,
          categoryName: 'Food',
          suggestedLimit: 450.56,
          reason: 'avg',
        },
        {
          categoryId: 2,
          categoryName: 'Housing',
          suggestedLimit: 2400,
          reason: 'mortgage',
        },
      ],
    });
  });

  it('drops suggestions for income and transfer categories (not budgetable)', () => {
    const r = interpretInsightResponse(
      {
        summary: 'ok',
        suggestions: [
          { categoryName: 'Income', suggestedLimit: 5000, reason: 'x' },
          { categoryName: 'Transfer', suggestedLimit: 100, reason: 'x' },
          { categoryName: 'Food', suggestedLimit: 300, reason: 'avg' },
        ],
      },
      [
        { id: 1, name: 'Food', isIncome: false, isTransfer: false },
        { id: 3, name: 'Income', isIncome: true, isTransfer: false },
        { id: 4, name: 'Transfer', isIncome: false, isTransfer: true },
      ],
    );
    expect(r!.suggestions).toEqual([
      {
        categoryId: 1,
        categoryName: 'Food',
        suggestedLimit: 300,
        reason: 'avg',
      },
    ]);
  });

  it('rejects responses without a summary', () => {
    expect(interpretInsightResponse({ suggestions: [] }, cats)).toBeNull();
    expect(interpretInsightResponse('text', cats)).toBeNull();
  });
});
