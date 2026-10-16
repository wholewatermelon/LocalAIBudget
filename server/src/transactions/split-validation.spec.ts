import { validateSplits } from './split-validation';

describe('validateSplits', () => {
  it('accepts splits that sum to the amount with the same sign (to the cent)', () => {
    expect(
      validateSplits(-100, [
        { categoryId: 1, amount: -60.1 },
        { categoryId: 2, amount: -39.9 },
      ]),
    ).toBeNull();
    expect(
      validateSplits(0.3, [
        { categoryId: 1, amount: 0.1 },
        { categoryId: 2, amount: 0.2 },
      ]),
    ).toBeNull(); // float-safe
    expect(validateSplits(-5, [])).toBeNull(); // clears
  });

  it('rejects wrong sums, mixed signs, zero and sub-cent amounts', () => {
    expect(
      validateSplits(-100, [
        { categoryId: 1, amount: -60 },
        { categoryId: 2, amount: -39.99 },
      ]),
    ).toMatch(/sum/);
    expect(
      validateSplits(-100, [
        { categoryId: 1, amount: -120 },
        { categoryId: 2, amount: 20 },
      ]),
    ).toMatch(/same sign/);
    expect(
      validateSplits(-100, [
        { categoryId: 1, amount: 0 },
        { categoryId: 2, amount: -100 },
      ]),
    ).toMatch(/non-zero/);
    expect(
      validateSplits(-1, [
        { categoryId: 1, amount: -0.555 },
        { categoryId: 2, amount: -0.445 },
      ]),
    ).toMatch(/decimals/);
    expect(validateSplits(0, [{ categoryId: 1, amount: 1 }])).toMatch(
      /zero-amount/,
    );
  });
});
