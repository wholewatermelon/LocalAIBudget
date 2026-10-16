import { budgetStatus, percentUsed } from './budget-status';

describe('budgetStatus', () => {
  it('is none when there is no limit', () => {
    expect(budgetStatus(50, 0)).toBe('none');
    expect(budgetStatus(0, 0)).toBe('none');
    expect(budgetStatus(10, -5)).toBe('none');
  });

  it('is green (ok) below 80%', () => {
    expect(budgetStatus(0, 100)).toBe('ok');
    expect(budgetStatus(79.99, 100)).toBe('ok');
  });

  it('is amber (warn) from 80% to 100% inclusive', () => {
    expect(budgetStatus(80, 100)).toBe('warn');
    expect(budgetStatus(90, 100)).toBe('warn');
    expect(budgetStatus(100, 100)).toBe('warn');
  });

  it('is red (over) above 100%', () => {
    expect(budgetStatus(100.01, 100)).toBe('over');
    expect(budgetStatus(500, 100)).toBe('over');
  });

  it('is robust to float noise at the boundaries', () => {
    // 0.1 * 3 = 0.30000000000000004 -> 100.00000000000001%
    expect(budgetStatus(0.1 * 3, 0.3)).toBe('warn');
    // 0.8 * 0.3 = 0.24 vs 0.24000000000000002
    expect(budgetStatus(0.24000000000000002, 0.3)).toBe('warn');
  });

  it('treats refunds (negative spent) as 0%', () => {
    expect(budgetStatus(-20, 100)).toBe('ok');
    expect(percentUsed(-20, 100)).toBe(0);
  });
});

describe('percentUsed', () => {
  it('returns null without a limit, percent otherwise', () => {
    expect(percentUsed(10, 0)).toBeNull();
    expect(percentUsed(25, 200)).toBe(12.5);
    expect(percentUsed(300, 200)).toBe(150);
  });
});
