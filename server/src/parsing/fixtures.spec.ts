import * as fs from 'fs';
import * as path from 'path';
import { accountTypeForName } from '../accounts/accounts.service';
import { LlmClient } from '../llm/llm-client';
import { parseStatementFileName } from '../statements/file-naming';
import { reconcile } from './reconciliation';
import { StatementParserService } from './statement-parser.service';

/**
 * Golden tests against the realistic fixtures in <repo>/fixtures/statements (see its README.md).
 * All of them must parse deterministically — the LLM must not be called.
 */
const FIXTURES = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'statements',
);

interface Expected {
  account: string;
  accountType: string;
  periodStart?: string;
  periodEnd?: string;
  openingBalance?: number;
  closingBalance?: number;
  expectReconciliation: 'ok' | 'mismatch' | 'unknown';
  transactions: { date: string; description: string; amount: number }[];
}

const noLlm: LlmClient = {
  model: 'none',
  generateJson: () =>
    Promise.reject(new Error('LLM must not be called for fixtures')),
  health: () => Promise.resolve({ reachable: false, modelAvailable: false }),
};

const key = (r: { date: string; description: string; amount: number }) =>
  `${r.date}|${r.description}|${r.amount.toFixed(2)}`;

const files = fs.existsSync(FIXTURES)
  ? fs
      .readdirSync(FIXTURES)
      .filter(
        (f) =>
          parseStatementFileName(f) &&
          fs.existsSync(path.join(FIXTURES, `${f}.expected.json`)),
      )
  : [];

describe('statement fixtures', () => {
  it('fixtures are present', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const parser = new StatementParserService(noLlm);

  describe.each(files)('%s', (file) => {
    const expected = JSON.parse(
      fs.readFileSync(path.join(FIXTURES, `${file}.expected.json`), 'utf8'),
    ) as Expected;
    const naming = parseStatementFileName(file)!;
    const ctx = {
      fileName: file,
      fileType: naming.fileType,
      month: naming.month!,
      accountType: accountTypeForName(naming.accountName),
    };

    it('derives account name and type from the file name', () => {
      expect(naming.accountName).toBe(expected.account);
      expect(ctx.accountType).toBe(expected.accountType);
    });

    it('produces exactly the expected transactions (multiset) and reconciliation', async () => {
      const result = await parser.parseFile(path.join(FIXTURES, file), ctx);
      expect(result.method).not.toBe('llm');
      expect(result.rows.map(key).sort()).toEqual(
        expected.transactions.map(key).sort(),
      );

      const meta = result.meta ?? {};
      if (expected.openingBalance !== undefined)
        expect(meta.openingBalance).toBeCloseTo(expected.openingBalance, 2);
      if (expected.closingBalance !== undefined)
        expect(meta.closingBalance).toBeCloseTo(expected.closingBalance, 2);
      const rec = reconcile(
        result.rows.map((r) => r.amount),
        meta.openingBalance,
        meta.closingBalance,
        ctx.accountType,
      );
      expect(rec.status).toBe(expected.expectReconciliation);
      if (expected.periodStart && meta.periodStart)
        expect(meta.periodStart).toBe(expected.periodStart);
      if (expected.periodEnd && meta.periodEnd)
        expect(meta.periodEnd).toBe(expected.periodEnd);
    });
  });
});
