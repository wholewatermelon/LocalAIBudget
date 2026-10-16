import {
  deriveMerchantKey,
  findMatchingRule,
  ruleMatches,
  RuleLike,
} from './rule-matching';

describe('rule matching', () => {
  const rule = (
    id: number,
    pattern: string,
    matchType: RuleLike['matchType'],
    priority = 0,
    categoryId = id,
  ): RuleLike => ({
    id,
    pattern,
    matchType,
    priority,
    categoryId,
  });

  it('matches against the normalized description', () => {
    expect(
      ruleMatches(rule(1, 'amzn mktp', 'contains'), 'AMZN  Mktp US*2K4L91'),
    ).toBe(true);
    expect(ruleMatches(rule(1, 'AMZN', 'starts_with'), 'POS AMZN')).toBe(false);
    expect(ruleMatches(rule(1, '^SQ \\*', 'regex'), 'sq *coffee')).toBe(true);
    expect(ruleMatches(rule(1, '(', 'regex'), 'anything')).toBe(false);
  });

  it('highest priority wins, then the longest pattern', () => {
    const rules = [
      rule(1, 'AMZN', 'contains'),
      rule(2, 'AMZN MKTP', 'contains'),
      rule(3, 'MKTP', 'contains', 5),
    ];
    expect(findMatchingRule(rules, 'AMZN MKTP US')!.id).toBe(3);
    expect(findMatchingRule(rules.slice(0, 2), 'AMZN MKTP US')!.id).toBe(2);
    expect(findMatchingRule(rules, 'WALMART')).toBeNull();
  });
});

describe('deriveMerchantKey', () => {
  it.each([
    ['AMZN Mktp US*2K4L91', 'AMZN MKTP'],
    ['SQ *BLUE BOTTLE COFFEE', 'BLUE BOTTLE COFFEE'],
    ['TST* JOES PIZZA 1234 SEATTLE WA', 'JOES PIZZA'],
    ['POS DEBIT 11/30 CHEVRON 0098812 FAIRVIEW OR', 'CHEVRON'],
    ['STARBUCKS STORE 05521 GRESHAM OR', 'STARBUCKS STORE'],
    ['Netflix Subscription', 'NETFLIX SUBSCRIPTION'],
    ['SQ *BLUE BOTTLE COFFEE SAN FRANCISCO CA', 'BLUE BOTTLE COFFEE'],
    ['BLUE BOTTLE COFFEE SAN FRANCISCO CA', 'BLUE BOTTLE COFFEE'],
    ['IN-N-OUT BURGER LOS ANGELES CA', 'IN-N-OUT BURGER'],
    ['JOES PIZZA NEW YORK NY', 'JOES PIZZA'],
    ['BLUE BOTTLE COFFEE OAKLAND CA', 'BLUE BOTTLE COFFEE'],
    ['TARGET CA', 'TARGET'],
    ['SAN FRANCISCO CA', 'SAN'], // never strips the whole description
    ['SPOTIFY', 'SPOTIFY'],
  ])('%s → %s', (desc, key) => expect(deriveMerchantKey(desc)).toBe(key));
});
