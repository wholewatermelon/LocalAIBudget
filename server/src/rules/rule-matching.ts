import { normalizeForMatch } from '../processing/dedupe';

export type MatchType = 'contains' | 'starts_with' | 'regex';
export const MATCH_TYPES: MatchType[] = ['contains', 'starts_with', 'regex'];

export interface RuleLike {
  id: number;
  pattern: string;
  matchType: MatchType;
  categoryId: number;
  priority: number;
}

/** Throws on an invalid regex. */
export function compileRegex(pattern: string): RegExp {
  return new RegExp(pattern, 'i');
}

export function ruleMatches(
  rule: Pick<RuleLike, 'pattern' | 'matchType'>,
  description: string,
): boolean {
  const d = normalizeForMatch(description);
  const p = normalizeForMatch(rule.pattern);
  switch (rule.matchType) {
    case 'contains':
      return p.length > 0 && d.includes(p);
    case 'starts_with':
      return p.length > 0 && d.startsWith(p);
    case 'regex':
      try {
        return compileRegex(rule.pattern).test(d);
      } catch {
        return false;
      }
  }
}

/** Highest priority wins, then the longest pattern, then lowest id. */
export function findMatchingRule<R extends RuleLike>(
  rules: R[],
  description: string,
): R | null {
  let best: R | null = null;
  for (const r of rules) {
    if (!ruleMatches(r, description)) continue;
    if (
      !best ||
      r.priority > best.priority ||
      (r.priority === best.priority &&
        r.pattern.length > best.pattern.length) ||
      (r.priority === best.priority &&
        r.pattern.length === best.pattern.length &&
        r.id < best.id)
    ) {
      best = r;
    }
  }
  return best;
}

const PREFIXES = [
  /^POS\s+(DEBIT|PURCHASE|WITHDRAWAL)\s*/,
  /^(DEBIT|CHECK|CHECKCARD|VISA|PURCHASE)\s+CARD\s+(PURCHASE\s+)?/,
  /^(DEBIT|CREDIT)\s+CARD\s+/,
  /^PURCHASE\s+(AUTHORIZED\s+)?(ON\s+)?/,
  /^RECURRING\s+(PAYMENT|DEBIT)\s*/,
  /^ACH\s+(DEBIT|CREDIT|WITHDRAWAL|DEPOSIT)?\s*/,
  /^(SQ|TST|SP|PP|PAYPAL|DD|IN|BT)\s?\*\s*/,
  /^\d{1,2}\/\d{1,2}(\/\d{2,4})?\s+/,
];

const US_STATES =
  'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC';

/** First words of common multi-word US city names ("SAN FRANCISCO", "LOS ANGELES", "NEW YORK", ...). */
const CITY_PREFIXES = new Set([
  'SAN',
  'SANTA',
  'LOS',
  'LAS',
  'NEW',
  'FORT',
  'FT',
  'ST',
  'SAINT',
  'EL',
  'PALO',
  'PORT',
  'SALT',
  'LONG',
  'NORTH',
  'SOUTH',
  'EAST',
  'WEST',
  'MOUNT',
  'MT',
]);

/**
 * Derives a merchant key for rule suggestions: strips processor prefixes (POS DEBIT, SQ *, TST*, ACH, dates),
 * trailing store numbers / reference ids / city+state. `AMZN Mktp US*2K4L91` → `AMZN MKTP`.
 */
export function deriveMerchantKey(description: string): string {
  let s = normalizeForMatch(description);
  for (let pass = 0; pass < 3; pass++)
    for (const re of PREFIXES) s = s.replace(re, '');
  // Cut at the first '*' or '#' that follows the merchant name (reference ids / store numbers).
  s = s.replace(/\s*[*#].*$/, '');
  const tokens = s.split(' ').filter(Boolean);
  // Drop trailing noise: state codes, tokens containing digits, country codes, phone-ish, "US"/"USA".
  const stateRe = new RegExp(`^(${US_STATES})$`);
  while (tokens.length > 1) {
    const t = tokens[tokens.length - 1];
    if (
      /\d/.test(t) ||
      stateRe.test(t) ||
      /^(US|USA|COM|INC|LLC)$/.test(t) ||
      /^[^A-Z0-9]+$/.test(t)
    ) {
      tokens.pop();
      // A city precedes a state code: drop it too (and a multi-word city's prefix such as SAN / LOS / NEW),
      // always keeping at least one word of the merchant name.
      if (stateRe.test(t) && tokens.length > 1) {
        tokens.pop();
        if (tokens.length > 1 && CITY_PREFIXES.has(tokens[tokens.length - 1]))
          tokens.pop();
      }
      continue;
    }
    break;
  }
  const key = tokens
    .slice(0, 4)
    .join(' ')
    .replace(/[.,-]+$/, '');
  return key || normalizeForMatch(description);
}
