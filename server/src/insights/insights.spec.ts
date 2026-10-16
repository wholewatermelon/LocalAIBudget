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

  it('rejects responses without a summary', () => {
    expect(interpretInsightResponse({ suggestions: [] }, cats)).toBeNull();
    expect(interpretInsightResponse('text', cats)).toBeNull();
  });
});
