import { MainBudgetItem, MonthBudgetItem } from '../../core/models';
import {
  buildSeedRequest,
  monthEditAction,
  monthRowState,
  noteEditAction,
  parseAmount,
  previousMonth,
  seedDiff,
  unhideAction,
} from './budget-logic';

function monthItem(over: Partial<MonthBudgetItem> = {}): MonthBudgetItem {
  return {
    categoryId: 1,
    categoryName: 'Food',
    mainAmount: 400,
    adjustedAmount: null,
    hidden: false,
    note: null,
    effectiveAmount: 400,
    source: 'main',
    spent: 100,
    remaining: 300,
    ...over,
  };
}

describe('budget logic', () => {
  it('previousMonth handles year boundaries', () => {
    expect(previousMonth('2024-03')).toBe('2024-02');
    expect(previousMonth('2024-01')).toBe('2023-12');
  });

  it('parseAmount', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount('$1,234.567')).toBe(1234.57);
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount('-5')).toBe('invalid');
    expect(parseAmount('abc')).toBe('invalid');
  });

  describe('monthRowState', () => {
    it('main rows: no chip, can hide', () => {
      const s = monthRowState(monthItem());
      expect(s.chip).toBeNull();
      expect(s.canHide).toBeTrue();
      expect(s.canReset).toBeFalse();
    });
    it('adjusted rows: chip, reset, note', () => {
      const s = monthRowState(monthItem({ source: 'adjusted', adjustedAmount: 500, effectiveAmount: 500 }));
      expect(s.chip?.label).toBe('adjusted');
      expect(s.canReset).toBeTrue();
      expect(s.hasNote).toBeTrue();
    });
    it('month-only rows: chip, reset removes, no hide', () => {
      const s = monthRowState(monthItem({ source: 'month-only', mainAmount: null, adjustedAmount: 80 }));
      expect(s.chip?.label).toBe('this month only');
      expect(s.canReset).toBeTrue();
      expect(s.canHide).toBeFalse();
    });
    it('hidden rows: greyed with un-hide', () => {
      const s = monthRowState(monthItem({ source: 'hidden', hidden: true, effectiveAmount: null }));
      expect(s.greyed).toBeTrue();
      expect(s.canUnhide).toBeTrue();
      expect(s.canHide).toBeFalse();
    });
    it('unbudgeted rows', () => {
      const s = monthRowState(monthItem({ source: 'unbudgeted', mainAmount: null, effectiveAmount: null }));
      expect(s.chip?.label).toBe('not budgeted');
      expect(s.canReset).toBeFalse();
    });
  });

  describe('monthEditAction', () => {
    it('does nothing when unchanged', () => {
      expect(monthEditAction(monthItem(), '400').kind).toBe('none');
    });
    it('PUTs a different amount', () => {
      expect(monthEditAction(monthItem(), '450')).toEqual({ kind: 'put', body: { amount: 450 } });
    });
    it('keeps the note when changing the amount', () => {
      const item = monthItem({ source: 'adjusted', adjustedAmount: 500, effectiveAmount: 500, note: 'party' });
      expect(monthEditAction(item, '520')).toEqual({ kind: 'put', body: { amount: 520, note: 'party' } });
    });
    it('resets to main when set back to the main amount without a note', () => {
      const item = monthItem({ source: 'adjusted', adjustedAmount: 500, effectiveAmount: 500 });
      expect(monthEditAction(item, '400')).toEqual({ kind: 'reset' });
    });
    it('budgets an unbudgeted category for this month', () => {
      const item = monthItem({ source: 'unbudgeted', mainAmount: null, effectiveAmount: null });
      expect(monthEditAction(item, '60')).toEqual({ kind: 'put', body: { amount: 60 } });
    });
    it('rejects empty/negative', () => {
      expect(monthEditAction(monthItem(), '').kind).toBe('invalid');
      expect(monthEditAction(monthItem(), '-1').kind).toBe('invalid');
    });
  });

  it('unhideAction: reset when there is a main amount, restore a month-only amount, else drop the record', () => {
    expect(unhideAction(monthItem({ hidden: true, source: 'hidden' }))).toEqual({ kind: 'reset' });
    expect(unhideAction(monthItem({ hidden: true, source: 'hidden', mainAmount: null, adjustedAmount: 70 }))).toEqual({
      kind: 'put',
      body: { hidden: false, amount: 70 },
    });
    expect(unhideAction(monthItem({ hidden: true, source: 'hidden', mainAmount: null, adjustedAmount: null }))).toEqual({ kind: 'reset' });
  });

  it('noteEditAction: note-only PUT when an adjustment record exists; "" clears', () => {
    const adj = monthItem({ source: 'adjusted', adjustedAmount: 500, effectiveAmount: 500, note: null });
    expect(noteEditAction(adj, ' trip ')).toEqual({ kind: 'put', body: { note: 'trip' } });
    expect(noteEditAction({ ...adj, note: 'trip' }, 'trip').kind).toBe('none');
    expect(noteEditAction({ ...adj, note: 'trip' }, '')).toEqual({ kind: 'put', body: { note: '' } });
    const hidden = monthItem({ source: 'hidden', hidden: true });
    expect(noteEditAction(hidden, 'skip')).toEqual({ kind: 'put', body: { note: 'skip' } });
  });

  it('noteEditAction on a plain main row creates the record with the current amount', () => {
    expect(noteEditAction(monthItem(), 'watch it')).toEqual({ kind: 'put', body: { amount: 400, note: 'watch it' } });
  });
});

describe('seed dialog logic', () => {
  const main = (categoryId: number, categoryName: string, amount: number): MainBudgetItem => ({
    categoryId,
    categoryName,
    amount,
    effectiveFrom: '2024-01',
    hasLaterChange: false,
  });

  it('buildSeedRequest only sends averageMonths for the average source', () => {
    const base = { fromMonth: '2024-02', averageMonths: 4, roundTo: 25 as const, effectiveFrom: '2024-03' };
    expect(buildSeedRequest({ ...base, source: 'actual' })).toEqual({
      fromMonth: '2024-02',
      source: 'actual',
      roundTo: 25,
      effectiveFrom: '2024-03',
    });
    expect(buildSeedRequest({ ...base, source: 'average' }).averageMonths).toBe(4);
    expect(buildSeedRequest({ ...base, source: 'average', averageMonths: 0 }).averageMonths).toBe(3);
    expect(buildSeedRequest({ ...base, source: 'average', averageMonths: 99 }).averageMonths).toBe(24);
  });

  it('diffs current vs proposed including removed categories', () => {
    const d = seedDiff(
      {
        items: [
          { categoryId: 1, categoryName: 'Food', amount: 425, currentMainAmount: 400 },
          { categoryId: 2, categoryName: 'Housing', amount: 1000, currentMainAmount: 1000 },
          { categoryId: 3, categoryName: 'Shopping', amount: 150, currentMainAmount: null },
        ],
        total: 1575,
      },
      [main(1, 'Food', 400), main(2, 'Housing', 1000), main(4, 'Gym', 50)],
    );
    expect(d.rows.map((r) => [r.categoryName, r.change])).toEqual([
      ['Food', 'changed'],
      ['Gym', 'removed'],
      ['Housing', 'same'],
      ['Shopping', 'new'],
    ]);
    expect(d.currentTotal).toBe(1450);
    expect(d.proposedTotal).toBe(1575);
    expect(d.counts).toEqual({ new: 1, removed: 1, changed: 1, same: 1 });
  });
});
