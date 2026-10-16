import { TrendPoint } from '../../core/models';
import { OTHER_KEY, OTHER_LABEL, UNCATEGORIZED_KEY, buildTrendModel } from './trend-chart';

describe('buildTrendModel', () => {
  const pt = (month: string, byCategory: Record<string, number>, totalIncome = 0, totalSpent?: number): TrendPoint => ({
    month,
    totalIncome,
    totalSpent: totalSpent ?? Object.values(byCategory).reduce((a, b) => a + b, 0),
    byCategory,
  });

  it('stacks categories per month and excludes non-spending names', () => {
    const m = buildTrendModel(
      [pt('2024-01', { Food: 100, Income: 999, Transfer: 50 }, 999, 100)],
      (n) => n === 'Income' || n === 'Transfer',
    );
    expect(m.series.map((s) => s.name)).toEqual(['Food']);
    expect(m.bars[0].segments.length).toBe(1);
    expect(m.bars[0].total).toBe(100);
    expect(m.incomePoints[0].value).toBe(999);
  });

  it('folds beyond 7 series into "Everything else" and keeps colors stable by name', () => {
    const cats: Record<string, number> = {};
    'ABCDEFGHI'.split('').forEach((c, i) => (cats[c] = 100 - i));
    const m = buildTrendModel([pt('2024-01', cats)], () => false);
    expect(m.series.length).toBe(8);
    expect(m.series[7]).toEqual({ key: OTHER_KEY, name: OTHER_LABEL, color: 'var(--series-8)' });
    expect(m.bars[0].segments.find((s) => s.key === OTHER_KEY)?.value).toBe(93 + 92);
    expect(m.series[0]).toEqual({ key: 'A', name: 'A', color: 'var(--series-1)' });
  });

  it('does not merge a real "Other" category with the overflow bucket', () => {
    const cats: Record<string, number> = { Other: 500 };
    'ABCDEFGH'.split('').forEach((c, i) => (cats[c] = 100 - i));
    const m = buildTrendModel([pt('2024-01', cats)], () => false);
    const real = m.bars[0].segments.find((s) => s.key === 'Other');
    const overflow = m.bars[0].segments.find((s) => s.key === OTHER_KEY);
    expect(real?.value).toBe(500);
    expect(real?.name).toBe('Other');
    expect(overflow?.name).toBe('Everything else');
    expect(overflow?.value).toBe(94 + 93); // G + H: the 8th and 9th largest
    expect(m.series.filter((s) => s.name === 'Other').length).toBe(1);
  });

  it('adds an Uncategorized segment = totalSpent - sum(byCategory), never negative', () => {
    const m = buildTrendModel(
      [
        pt('2024-01', { Food: 100, Housing: 200 }, 0, 350.5),
        pt('2024-02', { Food: 100 }, 0, 100),
        pt('2024-03', { Food: 100 }, 0, 90), // server rounding / refunds: never negative
      ],
      () => false,
    );
    const unc = (i: number) => m.bars[i].segments.find((s) => s.key === UNCATEGORIZED_KEY)?.value;
    expect(unc(0)).toBe(50.5);
    expect(unc(1)).toBeUndefined();
    expect(unc(2)).toBeUndefined();
    expect(m.bars[0].total).toBe(350.5);
    expect(m.series.at(-1)).toEqual({ key: UNCATEGORIZED_KEY, name: 'Uncategorized', color: 'var(--app-muted)' });
  });

  it('ignores excluded (income/transfer) amounts when computing uncategorized', () => {
    const m = buildTrendModel([pt('2024-01', { Food: 100, Transfer: 400 }, 0, 100)], (n) => n === 'Transfer');
    expect(m.bars[0].segments.map((s) => s.key)).toEqual(['Food']);
  });

  it('handles empty data', () => {
    const m = buildTrendModel([], () => false);
    expect(m.bars).toEqual([]);
    expect(m.ticks.length).toBe(5);
  });
});
