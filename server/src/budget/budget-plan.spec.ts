import {
  averageSpent,
  buildSeedProposal,
  effectiveBudgetMap,
  mainAsOf,
  MainVersion,
  resolveEffective,
  roundUp,
  seedWrites,
} from './budget-plan';

const v = (
  categoryId: number,
  effectiveFrom: string,
  amount: number | null,
): MainVersion => ({
  categoryId,
  effectiveFrom,
  amount,
});

describe('main budget versions', () => {
  const versions = [
    v(1, '2024-01', 400),
    v(1, '2024-06', 450),
    v(2, '2024-01', 100),
    v(2, '2024-04', null), // removed from main from April
    v(3, '2024-09', 50), // starts later
  ];

  it('uses the latest version with effective_from <= month', () => {
    const m = mainAsOf('2024-05', versions);
    expect(m.get(1)).toEqual({
      amount: 400,
      effectiveFrom: '2024-01',
      hasLaterChange: true,
    });
    expect(mainAsOf('2024-06', versions).get(1)).toEqual({
      amount: 450,
      effectiveFrom: '2024-06',
      hasLaterChange: false,
    });
  });

  it('treats a NULL version as a tombstone (removed from main) and ignores future versions', () => {
    expect(mainAsOf('2024-03', versions).get(2)?.amount).toBe(100);
    expect(mainAsOf('2024-04', versions).has(2)).toBe(false);
    expect(mainAsOf('2024-08', versions).has(3)).toBe(false);
    expect(mainAsOf('2024-09', versions).get(3)?.amount).toBe(50);
    expect(mainAsOf('2023-12', versions).size).toBe(0);
  });
});

describe('effective budget resolution', () => {
  const main = mainAsOf('2024-05', [
    v(1, '2024-01', 400),
    v(2, '2024-01', 100),
  ]);

  it('main only → source main', () => {
    expect(resolveEffective(1, main, undefined)).toMatchObject({
      mainAmount: 400,
      effectiveAmount: 400,
      source: 'main',
    });
  });

  it('adjustment overrides main → adjusted', () => {
    expect(
      resolveEffective(1, main, {
        categoryId: 1,
        amount: 600,
        hidden: false,
        note: 'party',
      }),
    ).toEqual({
      categoryId: 1,
      mainAmount: 400,
      adjustedAmount: 600,
      hidden: false,
      note: 'party',
      effectiveAmount: 600,
      source: 'adjusted',
    });
  });

  it('hidden → no effective amount', () => {
    expect(
      resolveEffective(2, main, {
        categoryId: 2,
        amount: null,
        hidden: true,
        note: null,
      }),
    ).toMatchObject({
      mainAmount: 100,
      hidden: true,
      effectiveAmount: null,
      source: 'hidden',
    });
  });

  it('adjustment without main → month-only; nothing → unbudgeted', () => {
    expect(
      resolveEffective(9, main, {
        categoryId: 9,
        amount: 75,
        hidden: false,
        note: null,
      }),
    ).toMatchObject({
      mainAmount: null,
      effectiveAmount: 75,
      source: 'month-only',
    });
    expect(resolveEffective(9, main, undefined)).toMatchObject({
      effectiveAmount: null,
      source: 'unbudgeted',
    });
  });

  it('a month adjustment still applies after the category was removed from main (tombstone)', () => {
    const versions = [v(1, '2024-01', 400), v(1, '2024-05', null)];
    expect(effectiveBudgetMap('2024-05', versions, []).has(1)).toBe(false);
    expect(
      effectiveBudgetMap('2024-05', versions, [
        { categoryId: 1, amount: 50, hidden: false, note: null },
      ]).get(1),
    ).toBe(50);
    expect(
      effectiveBudgetMap('2024-04', versions, [
        { categoryId: 1, amount: null, hidden: true, note: null },
      ]).has(1),
    ).toBe(false);
  });
});

describe('seed math', () => {
  it('rounds up to the step (in cents, no float drift)', () => {
    expect(roundUp(101, 25)).toBe(125);
    expect(roundUp(100, 25)).toBe(100);
    expect(roundUp(0.01, 50)).toBe(50);
    expect(roundUp(12.34, 1)).toBe(13);
    expect(roundUp(10.000000001, 5)).toBe(10);
    expect(roundUp(0, 25)).toBe(0);
  });

  it('averages over months with data only (empty months skipped)', () => {
    const spent = new Map([
      [
        '2024-01',
        new Map([
          [1, 100],
          [2, 30],
        ]),
      ],
      ['2024-03', new Map([[1, 300]])],
    ]);
    const avg = averageSpent(new Set(['2024-01', '2024-03']), spent, [
      '2024-01',
      '2024-02',
      '2024-03',
    ]);
    expect(avg.get(1)).toBe(200); // (100 + 300) / 2, Feb skipped
    expect(avg.get(2)).toBe(15); // (30 + 0) / 2
    expect(averageSpent(new Set(), new Map(), ['2024-02']).size).toBe(0);
  });

  it('builds a proposal: rounded up, zero amounts and non-budgetable categories dropped', () => {
    const raw = new Map([
      [1, 101],
      [2, 0],
      [3, 999], // income — not budgetable
      [4, 0.2],
    ]);
    expect(buildSeedProposal(raw, new Set([1, 2, 4]), 25)).toEqual([
      { categoryId: 1, amount: 125 },
      { categoryId: 4, amount: 25 },
    ]);
  });

  it('writes tombstones for categories currently in main but absent from the proposal', () => {
    const current = mainAsOf('2024-05', [
      v(1, '2024-01', 400),
      v(7, '2024-01', 60),
    ]);
    expect(
      seedWrites(
        [
          { categoryId: 1, amount: 425 },
          { categoryId: 2, amount: 50 },
        ],
        current,
      ),
    ).toEqual([
      { categoryId: 1, amount: 425 },
      { categoryId: 2, amount: 50 },
      { categoryId: 7, amount: null },
    ]);
  });
});
