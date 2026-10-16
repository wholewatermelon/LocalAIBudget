import {
  LlmClient,
  LlmResponseError,
  LlmTimeoutError,
  LlmUnavailableError,
} from '../llm/llm-client';
import {
  buildCategorizePrompt,
  CATEGORIZE_BATCH_SIZE,
  CategorizerService,
  interpretCategorizeResponse,
} from './categorizer.service';
import { computeDedupeKeys, normalizeForMatch } from './dedupe';
import { findTransferPairs, looksLikeTransfer } from './transfers';

const row = (
  date: string,
  description: string,
  amount: number,
  fitid?: string,
) => ({ date, description, amount, fitid });

describe('dedupe keys', () => {
  it('is stable, normalizes whitespace/case, and depends on the account', () => {
    const a = computeDedupeKeys(1, [row('2024-01-05', 'Walmart  Store', -1.5)]);
    const b = computeDedupeKeys(1, [
      row('2024-01-05', ' walmart store ', -1.5),
    ]);
    const c = computeDedupeKeys(2, [row('2024-01-05', 'Walmart Store', -1.5)]);
    expect(a).toEqual(b);
    expect(a[0]).not.toBe(c[0]);
    expect(a[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('counts identical rows within a file as separate occurrences', () => {
    const rows = [
      row('2024-01-05', 'Coffee', -3),
      row('2024-01-05', 'Coffee', -3),
      row('2024-01-05', 'Coffee', -4),
    ];
    const keys = computeDedupeKeys(1, rows);
    expect(new Set(keys).size).toBe(3);
    // Re-importing the same file yields the same keys (idempotent), occurrence 1 & 2 included.
    expect(computeDedupeKeys(1, rows)).toEqual(keys);
    // A later file with only one such row matches occurrence 1 only.
    expect(computeDedupeKeys(1, [rows[0]])[0]).toBe(keys[0]);
  });

  it('uses FITID for OFX rows', () => {
    const k1 = computeDedupeKeys(1, [row('2024-01-05', 'A', -1, 'F1')])[0];
    const k2 = computeDedupeKeys(1, [row('2024-01-06', 'B', -2, 'F1')])[0];
    expect(k1).toBe(k2);
  });

  it('normalizeForMatch uppercases and collapses whitespace', () => {
    expect(normalizeForMatch('  amzn   Mktp ')).toBe('AMZN MKTP');
  });
});

describe('categorizer', () => {
  const cats = [
    { name: 'Food' },
    { name: 'Income', isIncome: true },
    { name: 'Transfer', isTransfer: true },
    { name: 'Other' },
  ];
  const items = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      description: `Shop ${i + 1}`,
      amount: -1,
    }));

  it('maps invalid/missing categories to Other (flagged as fallback) and canonicalizes case', () => {
    const res = interpretCategorizeResponse(
      {
        results: [
          { id: 1, category: 'food', confidence: 0.9 },
          { id: 2, category: 'Groceries', confidence: 0.99 },
        ],
      },
      items(3),
      cats.map((c) => c.name),
    );
    expect(res.get(1)).toEqual({
      category: 'Food',
      confidence: 0.9,
      fallback: false,
    });
    expect(res.get(2)).toEqual({
      category: 'Other',
      confidence: 0,
      fallback: true,
    });
    expect(res.get(3)).toEqual({
      category: 'Other',
      confidence: 0,
      fallback: true,
    });
  });

  it('clamps confidence and tolerates a bare array matched by position', () => {
    const res = interpretCategorizeResponse(
      [{ category: 'Food', confidence: 7 }],
      items(1),
      ['Food', 'Other'],
    );
    expect(res.get(1)).toEqual({
      category: 'Food',
      confidence: 1,
      fallback: false,
    });
  });

  it('batches at most 20 per LLM call and includes few-shot corrections in the prompt', async () => {
    const prompts: string[] = [];
    const llm: LlmClient = {
      model: 'fake',
      generateJson: jest.fn((req: { prompt: string }) => {
        prompts.push(req.prompt);
        const tx = JSON.parse(/Transactions:\n(.*)\n/.exec(req.prompt)![1]) as {
          id: number;
        }[];
        return Promise.resolve({
          results: tx.map((t) => ({
            id: t.id,
            category: 'Food',
            confidence: 0.8,
          })),
        });
      }),
      health: jest.fn(),
    };
    const svc = new CategorizerService(llm);
    const batches: number[] = [];
    const res = await svc.categorize(
      items(45),
      cats,
      [{ description: 'AMZN MKTP', category: 'Shopping' }],
      (r) => {
        batches.push(r.size);
        return Promise.resolve();
      },
    );
    expect(CATEGORIZE_BATCH_SIZE).toBe(20);
    expect(batches).toEqual([20, 20, 5]);
    expect(res.size).toBe(45);
    expect(prompts.every((p) => p.includes('"AMZN MKTP" → Shopping'))).toBe(
      true,
    );
    expect(prompts[0]).toContain('- Transfer (');
  });

  it('falls back to Other on unparseable JSON but rethrows when the LLM is unreachable', async () => {
    const bad: LlmClient = {
      model: 'f',
      generateJson: () => Promise.reject(new LlmResponseError('x')),
      health: jest.fn(),
    };
    const res = await new CategorizerService(bad).categorize(
      items(2),
      cats,
      [],
    );
    expect(
      [...res.values()].every((r) => r.fallback && r.category === 'Other'),
    ).toBe(true);
    const down: LlmClient = {
      model: 'f',
      generateJson: () => Promise.reject(new LlmUnavailableError('down')),
      health: jest.fn(),
    };
    await expect(
      new CategorizerService(down).categorize(items(1), cats, []),
    ).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it('retries a timed-out batch once; succeeds on the retry', async () => {
    let calls = 0;
    const flaky: LlmClient = {
      model: 'f',
      generateJson: () =>
        ++calls === 1
          ? Promise.reject(new LlmTimeoutError('slow'))
          : Promise.resolve({
              results: [{ id: 1, category: 'Food', confidence: 0.9 }],
            }),
      health: jest.fn(),
    };
    const onTimeout = jest.fn();
    const res = await new CategorizerService(flaky).categorize(
      items(1),
      cats,
      [],
      undefined,
      onTimeout,
    );
    expect(calls).toBe(2);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(res.get(1)!.category).toBe('Food');
  });

  it('after two timeouts reports the batch via onBatchTimeout and continues with the next batch', async () => {
    let calls = 0;
    const llm: LlmClient = {
      model: 'f',
      generateJson: (r: { prompt: string }) => {
        calls++;
        // First batch (ids 1..20) always times out; second batch answers.
        if (r.prompt.includes('"id":1,'))
          return Promise.reject(new LlmTimeoutError('slow'));
        return Promise.resolve({
          results: [{ id: 21, category: 'Food', confidence: 0.9 }],
        });
      },
      health: jest.fn(),
    };
    const timedOut: number[][] = [];
    const res = await new CategorizerService(llm).categorize(
      items(21),
      cats,
      [],
      undefined,
      (batch) => {
        timedOut.push(batch.map((b) => b.id));
        return Promise.resolve();
      },
    );
    expect(calls).toBe(3); // 2 attempts for batch 1, 1 for batch 2
    expect(timedOut).toEqual([Array.from({ length: 20 }, (_, i) => i + 1)]);
    expect([...res.keys()]).toEqual([21]);
    // Without a handler the timeout propagates.
    await expect(
      new CategorizerService(llm).categorize(items(1), cats, []),
    ).rejects.toBeInstanceOf(LlmTimeoutError);
  });

  it('omits the examples block when there are no corrections', () => {
    expect(buildCategorizePrompt(items(1), cats, [])).not.toContain(
      'corrected',
    );
  });
});

describe('transfer matching', () => {
  const c = (
    id: number,
    accountId: number,
    date: string,
    amount: number,
    description: string,
  ) => ({
    id,
    accountId,
    date,
    amount,
    description,
  });

  it('pairs opposite amounts across accounts within 5 days, preferring the closest date', () => {
    const pairs = findTransferPairs([
      c(1, 1, '2024-12-20', -1850, 'ONLINE PMT SUMMIT VISA'),
      c(2, 2, '2024-12-23', 1850, 'PAYMENT THANK YOU - WEB'),
      c(3, 3, '2024-12-21', 1850, 'PAYMENT THANK YOU'), // closer → wins
      c(4, 1, '2024-12-05', -500, 'ONLINE TRANSFER TO SAVINGS'),
      c(5, 4, '2024-12-06', 500, 'ONLINE TRANSFER FROM CHECKING'),
    ]);
    expect(pairs).toEqual([
      [1, 3],
      [4, 5],
    ]);
  });

  it('does not pair same account, > 5 days apart, or when neither side looks like a transfer', () => {
    expect(
      findTransferPairs([
        c(1, 1, '2024-12-01', -10, 'TRANSFER'),
        c(2, 1, '2024-12-01', 10, 'TRANSFER'),
      ]),
    ).toEqual([]);
    expect(
      findTransferPairs([
        c(1, 1, '2024-12-01', -10, 'TRANSFER'),
        c(2, 2, '2024-12-07', 10, 'TRANSFER'),
      ]),
    ).toEqual([]);
    expect(
      findTransferPairs([
        c(1, 1, '2024-12-01', -10, 'GROCERY'),
        c(2, 2, '2024-12-01', 10, 'REFUND'),
      ]),
    ).toEqual([]);
    // Utility "ONLINE PMT" with no opposite amount stays unpaired.
    expect(
      findTransferPairs([
        c(1, 1, '2024-12-09', -177.43, 'CASCADE POWER & LIGHT ONLINE PMT'),
      ]),
    ).toEqual([]);
  });

  it('pairs when the category is already Transfer even without keywords', () => {
    expect(
      findTransferPairs([
        { ...c(1, 1, '2024-12-01', -10, 'MOVE'), categoryIsTransfer: true },
        c(2, 2, '2024-12-02', 10, 'DEPOSIT'),
      ]),
    ).toEqual([[1, 2]]);
    expect(looksLikeTransfer({ description: 'HARBOR CARD AUTOPAY' })).toBe(
      true,
    );
  });
});
