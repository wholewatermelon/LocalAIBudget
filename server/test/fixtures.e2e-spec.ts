import { copyFixture, createTestApp, processMonth, TestContext } from './utils';

/** Realistic fixtures from <repo>/fixtures/statements: transfers, reconciliation, OFX preference, rules, review. */
describe('realistic statements (e2e)', () => {
  let ctx: TestContext;
  const tx = async (q = '') =>
    (await ctx.http().get(`/api/transactions${q}`).expect(200)).body as any[];
  const find = (rows: any[], re: RegExp) =>
    rows.filter((t) => re.test(t.description));

  beforeAll(async () => {
    ctx = await createTestApp();
    for (const f of [
      'Maple_Federal_Checking_2024-12.pdf',
      'Summit_Rewards_Visa_2024-12.pdf',
      'Harbor_Cash_Back_Card_2024-12.csv',
      'Maple_Federal_Savings_2024-12.txt',
    ]) {
      copyFixture(ctx, f, '2024-12');
    }
  });
  afterAll(async () => {
    await ctx.jobs.waitForIdle();
    await ctx.app.close();
  });

  it('imports the December set, pairs transfers across accounts and reconciles statements', async () => {
    const job = await processMonth(ctx, '2024-12');
    expect(job.status).toBe('completed');
    expect(job.inserted).toBe(18 + 16 + 12 + 3);
    expect(job.transfersMatched).toBe(4);
    expect(job.errors).toEqual([]);

    const all = await tx();
    const pairOf = (re: RegExp) => {
      const [row] = find(all, re);
      expect(row).toBeDefined();
      return row;
    };
    const summitPmt = pairOf(/^ONLINE PMT SUMMIT VISA/);
    expect(summitPmt).toMatchObject({
      categoryName: 'Transfer',
      categorizedBy: 'transfer',
      transferPairAccountName: 'Summit Rewards Visa',
    });
    expect(all.find((t) => t.id === summitPmt.transferPairId).description).toBe(
      'PAYMENT THANK YOU - WEB',
    );
    expect(pairOf(/^HARBOR CARD AUTOPAY/).transferPairAccountName).toBe(
      'Harbor Cash Back Card',
    );
    expect(
      pairOf(/^ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS/)
        .transferPairAccountName,
    ).toBe('Maple Federal Savings');
    expect(
      pairOf(/^ONLINE TRANSFER FROM MAPLE FEDERAL SAVINGS/)
        .transferPairAccountName,
    ).toBe('Maple Federal Savings');

    // Unpaired transfer stays unpaired and goes to review; keyword traps are not transfers and not flagged.
    const tidewater = pairOf(/TIDEWATER/);
    expect(tidewater).toMatchObject({
      transferPairId: null,
      categoryName: 'Transfer',
      categorizedBy: 'ai',
      needsReview: true,
    });
    expect(pairOf(/CASCADE POWER & LIGHT ONLINE PMT/)).toMatchObject({
      transferPairId: null,
      categoryName: 'Utilities',
      needsReview: false,
    });
    expect(pairOf(/^INTEREST PAYMENT/)).toMatchObject({
      transferPairId: null,
      categoryName: 'Income',
      needsReview: false,
    });

    // Card signs normalized: Summit purchases negative, payment positive; Harbor CSV not flipped.
    expect(pairOf(/^PAYMENT THANK YOU - WEB/).amount).toBe(1850);
    expect(pairOf(/^SPOTIFY/).amount).toBe(-16.99);
    expect(pairOf(/^PANDA EXPRESS/).amount).toBe(-54.3);

    const files = (
      await ctx.http().get('/api/statements?month=2024-12').expect(200)
    ).body;
    const status = Object.fromEntries(
      files.map((f: any) => [f.fileName, f.reconciliationStatus]),
    );
    expect(status).toEqual({
      'Harbor_Cash_Back_Card_2024-12.csv': 'unknown',
      'Maple_Federal_Checking_2024-12.pdf': 'ok',
      'Maple_Federal_Savings_2024-12.txt': 'unknown',
      'Summit_Rewards_Visa_2024-12.pdf': 'ok',
    });
    const summit = files.find((f: any) => f.fileName.startsWith('Summit'));
    expect(summit).toMatchObject({
      periodStart: '2024-12-05',
      periodEnd: '2025-01-04',
      openingBalance: 5528.28,
      closingBalance: 4924.65,
      reconciliationDiff: 0,
    });

    // Month filtering is by transaction_date: Summit's January rows show up in 2025-01.
    const jan = await tx('?month=2025-01');
    expect(jan.length).toBeGreaterThan(0);
    expect(
      jan.every(
        (t) => t.date.startsWith('2025-01') && t.statementMonth === '2024-12',
      ),
    ).toBe(true);

    // Budget totals exclude transfer pairs.
    const s = (
      await ctx.http().get('/api/budget/summary?month=2024-12').expect(200)
    ).body;
    const transferLine = s.categories.find((c: any) => c.isTransfer);
    expect(transferLine.spent).toBeGreaterThan(0);
    const months = (await ctx.http().get('/api/months').expect(200)).body;
    expect(months.find((m: any) => m.month === '2024-12')).toMatchObject({
      fileCount: 4,
      reconciliationIssues: 0,
    });
  });

  it('flags a statement whose balances do not reconcile', async () => {
    copyFixture(ctx, 'Maple_Federal_Checking_2024-11.pdf', '2024-11');
    const job = await processMonth(ctx, '2024-11');
    expect(job.status).toBe('completed');
    expect(job.inserted).toBe(10);
    expect(job.errors).toEqual([
      {
        file: 'Maple_Federal_Checking_2024-11.pdf',
        message: 'Reconciliation mismatch: off by $42.17 — rows may be missing',
      },
    ]);
    const [file] = (
      await ctx.http().get('/api/statements?month=2024-11').expect(200)
    ).body;
    expect(file).toMatchObject({
      reconciliationStatus: 'mismatch',
      reconciliationDiff: -42.17,
      closingBalance: 4254.47,
    });
    const months = (await ctx.http().get('/api/months').expect(200)).body;
    expect(
      months.find((m: any) => m.month === '2024-11').reconciliationIssues,
    ).toBe(1);
  });

  it('prefers OFX over a same-basename CSV and dedupes OFX by FITID', async () => {
    copyFixture(ctx, 'Maple_Federal_Checking_2025-01.csv', '2025-01');
    copyFixture(ctx, 'Maple_Federal_Checking_2025-01.ofx', '2025-01');
    const job = await processMonth(ctx, '2025-01');
    expect(job).toMatchObject({ status: 'completed', inserted: 12 });
    const files = (
      await ctx.http().get('/api/statements?month=2025-01').expect(200)
    ).body;
    const byName = Object.fromEntries(files.map((f: any) => [f.fileName, f]));
    expect(byName['Maple_Federal_Checking_2025-01.ofx']).toMatchObject({
      fileType: 'ofx',
      lastParseMethod: 'ofx',
      transactionCount: 12,
      closingBalance: 6535.4,
    });
    expect(
      byName['Maple_Federal_Checking_2025-01.csv'].lastProcessedAt,
    ).toBeNull();
    const again = await processMonth(ctx, '2025-01');
    expect(again).toMatchObject({ inserted: 0, skippedDuplicates: 12 });
  });

  it('rules: suggest, preview, create with applyToExisting, re-applied on recategorize', async () => {
    const [ret] = find(await tx(), /RETURN Amzn/);
    const suggestion = (
      await ctx
        .http()
        .get(`/api/rules/suggest?transactionId=${ret.id}`)
        .expect(200)
    ).body;
    expect(suggestion).toEqual({
      pattern: 'AMZN MKTP',
      matchType: 'contains',
      matchCount: 3,
    });

    const preview = (
      await ctx
        .http()
        .post('/api/rules/preview')
        .send({ pattern: 'amzn mktp' })
        .expect(200)
    ).body;
    expect(preview.matchCount).toBe(3);
    expect(preview.sample).toHaveLength(3);

    const cats = (await ctx.http().get('/api/categories').expect(200)).body;
    const housing = cats.find((c: any) => c.name === 'Housing');
    const rule = (
      await ctx
        .http()
        .post('/api/rules')
        .send({
          pattern: 'AMZN MKTP',
          categoryId: housing.id,
          applyToExisting: true,
        })
        .expect(201)
    ).body;
    expect(rule).toMatchObject({
      pattern: 'AMZN MKTP',
      matchType: 'contains',
      categoryName: 'Housing',
      priority: 0,
      hits: 3,
      appliedCount: 3,
    });
    expect(
      find(await tx(), /AMZN Mktp/).every(
        (t) => t.categoryName === 'Housing' && t.categorizedBy === 'rule',
      ),
    ).toBe(true);

    await ctx
      .http()
      .post('/api/rules')
      .send({ pattern: 'AMZN MKTP', categoryId: housing.id })
      .expect(409);
    await ctx
      .http()
      .post('/api/rules')
      .send({ pattern: '(', matchType: 'regex', categoryId: housing.id })
      .expect(400);
    await ctx
      .http()
      .post('/api/rules')
      .send({ pattern: 'X', matchType: 'fuzzy', categoryId: housing.id })
      .expect(400);

    const job = await processMonth(ctx, '2024-12', 'recategorize');
    expect(job.status).toBe('completed');
    expect(job.rulesApplied).toBe(3);
    expect(
      find(await tx(), /AMZN Mktp/).every((t) => t.categorizedBy === 'rule'),
    ).toBe(true);
    // Transfer pairs and manual corrections survive recategorize.
    expect(
      find(await tx('?month=2024-12'), /^ONLINE PMT SUMMIT VISA/)[0]
        .categorizedBy,
    ).toBe('transfer');

    const patched = (
      await ctx
        .http()
        .patch(`/api/rules/${rule.id}`)
        .send({ priority: 5 })
        .expect(200)
    ).body;
    expect(patched).toMatchObject({ priority: 5, pattern: 'AMZN MKTP' });
    const list = (await ctx.http().get('/api/rules').expect(200)).body;
    expect(list).toHaveLength(1);
    await ctx.http().delete(`/api/rules/${rule.id}`).expect(204);
    await ctx.http().delete(`/api/rules/${rule.id}`).expect(404);
  });

  it('applyToExisting respects rule priority and never touches transfer-paired rows', async () => {
    const cats = (await ctx.http().get('/api/categories').expect(200)).body;
    const id = (n: string) => cats.find((c: any) => c.name === n).id;
    const create = (body: object) =>
      ctx
        .http()
        .post('/api/rules')
        .send({ applyToExisting: true, ...body })
        .expect(201);

    const high = (
      await create({
        pattern: 'AMZN',
        priority: 10,
        categoryId: id('Shopping'),
      })
    ).body;
    expect(high.appliedCount).toBe(3);
    // Lower priority (even though longer) → the existing higher-priority rule keeps winning.
    const low = (
      await create({
        pattern: 'AMZN MKTP',
        priority: 0,
        categoryId: id('Housing'),
      })
    ).body;
    expect(low.appliedCount).toBe(0);
    expect(
      find(await tx(), /AMZN Mktp/).every((t) => t.categoryName === 'Shopping'),
    ).toBe(true);

    // Transfer-paired rows are skipped.
    const pmt = (
      await create({ pattern: 'PAYMENT THANK YOU', categoryId: id('Housing') })
    ).body;
    expect(pmt.appliedCount).toBe(0);
    const [paired] = find(
      await tx('?month=2024-12'),
      /^PAYMENT THANK YOU - WEB/,
    );
    expect(paired).toMatchObject({
      categoryName: 'Transfer',
      categorizedBy: 'transfer',
    });
    expect(paired.transferPairId).not.toBeNull();

    for (const r of [high, low, pmt])
      await ctx.http().delete(`/api/rules/${r.id}`).expect(204);
  });

  it('suggest matchCount equals what applyToExisting actually updates (manual, split, paired rows excluded)', async () => {
    const cats = (await ctx.http().get('/api/categories').expect(200)).body;
    const id = (n: string) => cats.find((c: any) => c.name === n).id;
    const amzn = find(await tx(), /AMZN Mktp/);
    expect(amzn).toHaveLength(3);
    // The clicked row is a manual correction (as after the client's PATCH) → excluded from the count.
    await ctx
      .http()
      .patch(`/api/transactions/${amzn[0].id}`)
      .send({ categoryId: id('Shopping') })
      .expect(200);
    const s = (
      await ctx
        .http()
        .get(`/api/rules/suggest?transactionId=${amzn[0].id}`)
        .expect(200)
    ).body;
    expect(s).toEqual({
      pattern: 'AMZN MKTP',
      matchType: 'contains',
      matchCount: 2,
    });
    const rule = (
      await ctx
        .http()
        .post('/api/rules')
        .send({
          pattern: s.pattern,
          matchType: s.matchType,
          categoryId: id('Shopping'),
          applyToExisting: true,
        })
        .expect(201)
    ).body;
    expect(rule.appliedCount).toBe(s.matchCount);
    await ctx.http().delete(`/api/rules/${rule.id}`).expect(204);

    // A transfer-paired row: its own pair never counts.
    const [paired] = find(
      await tx('?month=2024-12'),
      /^PAYMENT THANK YOU - WEB/,
    );
    const ps = (
      await ctx
        .http()
        .get(`/api/rules/suggest?transactionId=${paired.id}`)
        .expect(200)
    ).body;
    const pr = (
      await ctx
        .http()
        .post('/api/rules')
        .send({
          pattern: ps.pattern,
          categoryId: id('Transfer'),
          applyToExisting: true,
        })
        .expect(201)
    ).body;
    expect(pr.appliedCount).toBe(ps.matchCount);
    await ctx.http().delete(`/api/rules/${pr.id}`).expect(204);
  });

  it('review queue: filter and bulk approve', async () => {
    const queue = await tx('?needsReview=true');
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every((t) => t.needsReview)).toBe(true);
    const res = await ctx
      .http()
      .post('/api/transactions/review')
      .send({ ids: queue.map((t) => t.id) })
      .expect(200);
    expect(res.body).toEqual({ updated: queue.length });
    expect(await tx('?needsReview=true')).toEqual([]);
    await ctx
      .http()
      .post('/api/transactions/review')
      .send({ ids: ['a'] })
      .expect(400);
  });
});
