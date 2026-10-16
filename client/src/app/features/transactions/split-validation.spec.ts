import { toCents, validateSplits } from './split-validation';

describe('toCents', () => {
  it('rounds float noise to integer cents', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(-19.99)).toBe(-1999);
    expect(toCents(1.005)).toBe(100); // 1.005 is 1.00499999… in binary; matches what a user can type at 2dp
    expect(toCents(-0.29)).toBe(-29);
  });

  it('parses strings incl. thousands separators', () => {
    expect(toCents('12.30')).toBe(1230);
    expect(toCents('1,234.5')).toBe(123450);
    expect(toCents(' -7 ')).toBe(-700);
  });

  it('returns null for empty or non-numeric', () => {
    expect(toCents(null)).toBeNull();
    expect(toCents(undefined)).toBeNull();
    expect(toCents('')).toBeNull();
    expect(toCents('   ')).toBeNull();
    expect(toCents('abc')).toBeNull();
    expect(toCents(NaN)).toBeNull();
  });
});

describe('validateSplits', () => {
  it('accepts an empty list (clears splits)', () => {
    const v = validateSplits(-50, []);
    expect(v.valid).toBeTrue();
    expect(v.splits).toEqual([]);
  });

  it('accepts negative splits that sum exactly', () => {
    const v = validateSplits(-100, [
      { categoryId: 1, amount: -60 },
      { categoryId: 2, amount: -40 },
    ]);
    expect(v.valid).toBeTrue();
    expect(v.remaining).toBe(0);
    expect(v.splits).toEqual([
      { categoryId: 1, amount: -60 },
      { categoryId: 2, amount: -40 },
    ]);
  });

  it('is exact to the cent despite floating point (0.1 + 0.2 = 0.3)', () => {
    const v = validateSplits(-0.3, [
      { categoryId: 1, amount: -0.1 },
      { categoryId: 2, amount: -0.2 },
    ]);
    expect(v.valid).toBeTrue();
    expect(v.remaining).toBe(0);
  });

  it('handles many small cents that would drift as floats', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ categoryId: i + 1, amount: -0.07 }));
    const v = validateSplits(-0.7, rows);
    expect(v.valid).toBeTrue();
  });

  it('handles awkward decimals like 33.33 + 33.33 + 33.34', () => {
    const v = validateSplits(-100, [
      { categoryId: 1, amount: -33.33 },
      { categoryId: 2, amount: -33.33 },
      { categoryId: 3, amount: -33.34 },
    ]);
    expect(v.valid).toBeTrue();
  });

  it('rejects a one-cent mismatch and reports remaining', () => {
    const v = validateSplits(-100, [
      { categoryId: 1, amount: -60 },
      { categoryId: 2, amount: -39.99 },
    ]);
    expect(v.valid).toBeFalse();
    expect(v.remaining).toBe(-0.01);
    expect(v.errors[0]).toContain('short');
    expect(v.splits).toEqual([]);
  });

  it('reports overshoot', () => {
    const v = validateSplits(-10, [
      { categoryId: 1, amount: -6 },
      { categoryId: 2, amount: -5 },
    ]);
    expect(v.valid).toBeFalse();
    expect(v.remaining).toBe(1);
    expect(v.errors[0]).toContain('exceed');
  });

  it('works for positive (income) transactions', () => {
    expect(validateSplits(250.5, [{ categoryId: 1, amount: 200 }, { categoryId: 2, amount: 50.5 }]).valid).toBeTrue();
    const bad = validateSplits(100, [{ categoryId: 1, amount: 150 }, { categoryId: 2, amount: -50 }]);
    expect(bad.valid).toBeFalse();
    expect(bad.rowErrors[1]).toContain('positive');
  });

  it('rejects a split with the opposite sign even if the sum matches', () => {
    const v = validateSplits(-50, [
      { categoryId: 1, amount: -70 },
      { categoryId: 2, amount: 20 },
    ]);
    expect(v.valid).toBeFalse();
    expect(v.rowErrors[1]).toContain('negative');
  });

  it('requires category and amount on each row', () => {
    const v = validateSplits(-50, [
      { categoryId: null, amount: -25 },
      { categoryId: 2, amount: null },
    ]);
    expect(v.valid).toBeFalse();
    expect(v.rowErrors[0]).toContain('category');
    expect(v.rowErrors[1]).toContain('amount');
  });

  it('rejects zero amounts', () => {
    const v = validateSplits(-50, [
      { categoryId: 1, amount: -50 },
      { categoryId: 2, amount: 0 },
    ]);
    expect(v.valid).toBeFalse();
    expect(v.rowErrors[1]).toContain('zero');
  });

  it('rejects more than 2 decimal places', () => {
    const v = validateSplits(-10, [
      { categoryId: 1, amount: -5.005 },
      { categoryId: 2, amount: -4.995 },
    ]);
    expect(v.valid).toBeFalse();
    expect(v.rowErrors[0]).toContain('decimal');
  });

  it('accepts string amounts from inputs', () => {
    const v = validateSplits(-12.3, [
      { categoryId: 1, amount: '-10.30' },
      { categoryId: 2, amount: '-2' },
    ]);
    expect(v.valid).toBeTrue();
    expect(v.splits).toEqual([
      { categoryId: 1, amount: -10.3 },
      { categoryId: 2, amount: -2 },
    ]);
  });

  it('cannot split a zero-amount transaction', () => {
    const v = validateSplits(0, [{ categoryId: 1, amount: 1 }]);
    expect(v.valid).toBeFalse();
  });

  it('computes live remaining while rows are incomplete', () => {
    const v = validateSplits(-80, [
      { categoryId: 1, amount: -30 },
      { categoryId: null, amount: null },
    ]);
    expect(v.remaining).toBe(-50);
  });
});
