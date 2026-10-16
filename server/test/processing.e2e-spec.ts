import { LlmTimeoutError } from '../src/llm/llm-client';
import {
  createTestApp,
  makePdf,
  processMonth,
  TestContext,
  waitForJob,
} from './utils';

const TXT_ROWS = [
  '2024-01-05 Walmart Store 1234 -150.25',
  '2024-01-07 Shell Gas Station -45.00',
  '2024-01-10 Netflix Subscription -15.99',
  '2024-01-12 Employer Payroll 2,500.00',
  '2024-01-15 City Water Dept -60.00',
  '2024-01-20 McDonalds -12.50',
  '2024-01-20 McDonalds -12.50', // identical row → occurrence 2, still imported
  '2024-01-22 Mystery Merchant -9.99',
];

describe('processing pipeline (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.jobs.waitForIdle();
    await ctx.app.close();
  });

  it('uploads statements (PDF preferred over same-basename TXT) and lists them', async () => {
    const pdf = await makePdf('Main Checking Statement', TXT_ROWS);
    const res = await ctx
      .http()
      .post('/api/statements/upload')
      .attach(
        'files',
        Buffer.from(TXT_ROWS.join('\n')),
        'Main_Checking_2024-01.txt',
      )
      .attach('files', pdf, 'Main_Checking_2024-01.pdf')
      .attach(
        'files',
        Buffer.from('2024-01-09 Kroger Grocery -80.00\n'),
        'Travel_Rewards_Card.txt',
      )
      .field('month', '2024-01')
      .expect(201);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toMatchObject({
      month: '2024-01',
      fileName: 'Main_Checking_2024-01.txt',
      fileType: 'txt',
      accountName: 'Main Checking',
    });
    const list = await ctx
      .http()
      .get('/api/statements?month=2024-01')
      .expect(200);
    expect(list.body.map((f: any) => f.fileName).sort()).toEqual([
      'Main_Checking_2024-01.pdf',
      'Main_Checking_2024-01.txt',
      'Travel_Rewards_Card.txt',
    ]);
    const accounts = await ctx.http().get('/api/accounts').expect(200);
    expect(accounts.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountName: 'Main Checking',
          accountType: 'Bank',
        }),
        expect.objectContaining({
          accountName: 'Travel Rewards Card',
          accountType: 'Credit Card',
        }),
      ]),
    );
  });

  it('rejects uploads without a month or with bad types', async () => {
    await ctx
      .http()
      .post('/api/statements/upload')
      .attach('files', Buffer.from('x'), 'NoMonth.txt')
      .expect(400);
    await ctx
      .http()
      .post('/api/statements/upload')
      .attach('files', Buffer.from('x'), 'Bad_2024-01.exe')
      .expect(400);
    await ctx.http().post('/api/statements/upload').expect(400);
  });

  it('processes a month: job completes, rows imported once, categorized, invalid → Other', async () => {
    const job = await processMonth(ctx, '2024-01');
    expect(job).toMatchObject({
      status: 'completed',
      month: '2024-01',
      mode: 'incremental',
    });
    // PDF (8 rows) + card TXT (1 row); the duplicate TXT is skipped by preference.
    expect(job.inserted).toBe(9);
    expect(job.skippedDuplicates).toBe(0);
    expect(job.categorized).toBe(9);
    expect(job.message).toBe(
      'Processed 2 files: 9 new rows — 0 by rules, 0 transfer pairs, 9 by Gemma (0 duplicates skipped)',
    );
    expect(job.total).toBe(2 + 9);
    expect(job.processed).toBe(job.total);

    const tx = (
      await ctx.http().get('/api/transactions?month=2024-01').expect(200)
    ).body;
    expect(tx).toHaveLength(9);
    expect(tx[0].date >= tx[tx.length - 1].date).toBe(true); // date desc
    const by = (d: string) => tx.filter((t: any) => t.description === d);
    expect(by('Walmart Store 1234')[0]).toMatchObject({
      amount: -150.25,
      categoryName: 'Shopping',
      categorizedBy: 'ai',
      accountName: 'Main Checking',
    });
    expect(by('Employer Payroll')[0]).toMatchObject({
      amount: 2500,
      categoryName: 'Income',
    });
    expect(by('McDonalds')).toHaveLength(2);
    expect(by('Mystery Merchant')[0]).toMatchObject({
      categoryName: 'Other',
      needsReview: true,
    });
    expect(typeof tx[0].amount).toBe('number');

    const files = (
      await ctx.http().get('/api/statements?month=2024-01').expect(200)
    ).body;
    const pdf = files.find((f: any) => f.fileName.endsWith('.pdf'));
    expect(pdf).toMatchObject({
      lastParseMethod: 'regex',
      transactionCount: 8,
    });
    expect(
      files.find((f: any) => f.fileName === 'Main_Checking_2024-01.txt')
        .lastProcessedAt,
    ).toBeNull();

    const months = (await ctx.http().get('/api/months').expect(200)).body;
    expect(months[0]).toMatchObject({
      month: '2024-01',
      fileCount: 3,
      transactionCount: 9,
      uncategorizedCount: 0,
    });
  });

  it('re-processing is idempotent (0 inserted, duplicates skipped)', async () => {
    const job = await processMonth(ctx, '2024-01');
    expect(job).toMatchObject({
      status: 'completed',
      inserted: 0,
      skippedDuplicates: 9,
      categorized: 0,
    });
    expect(
      (await ctx.http().get('/api/transactions?month=2024-01').expect(200))
        .body,
    ).toHaveLength(9);
  });

  it('PATCH correction marks manual; recategorize keeps manual corrections and splits; corrections become few-shot', async () => {
    const tx = (
      await ctx
        .http()
        .get('/api/transactions?month=2024-01&search=walmart')
        .expect(200)
    ).body;
    const walmart = tx[0];
    const cats = (await ctx.http().get('/api/categories').expect(200)).body;
    const id = (n: string) => cats.find((c: any) => c.name === n).id;

    const patched = await ctx
      .http()
      .patch(`/api/transactions/${walmart.id}`)
      .send({ categoryId: id('Food') })
      .expect(200);
    expect(patched.body).toMatchObject({
      categoryName: 'Food',
      isManualCorrection: true,
      categorizedBy: 'manual',
      needsReview: false,
    });

    const netflix = (
      await ctx.http().get('/api/transactions?search=netflix').expect(200)
    ).body[0];
    await ctx
      .http()
      .put(`/api/transactions/${netflix.id}/splits`)
      .send({
        splits: [
          { categoryId: id('Entertainment'), amount: -10 },
          { categoryId: id('Other'), amount: -5.99 },
        ],
      })
      .expect(200);
    // Simulate a later AI category on the split row being something else, to prove recategorize skips it.
    await ctx.db.query(
      `UPDATE transactions SET category_id = $2 WHERE id = $1`,
      [netflix.id, id('Housing')],
    );

    ctx.llm.calls = [];
    const job = await processMonth(ctx, '2024-01', 'recategorize');
    expect(job.status).toBe('completed');
    expect(job.categorized).toBe(7); // 9 rows − manual − split
    const prompts = ctx.llm.calls
      .filter((c) => c.task === 'categorize')
      .map((c) => c.prompt);
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts[0]).toContain('"Walmart Store 1234" → Food');
    expect(prompts.join('\n')).not.toContain('Netflix');

    const after = (
      await ctx.http().get('/api/transactions?month=2024-01').expect(200)
    ).body;
    expect(after.find((t: any) => t.id === walmart.id)).toMatchObject({
      categoryName: 'Food',
      categorizedBy: 'manual',
    });
    const n = after.find((t: any) => t.id === netflix.id);
    expect(n.categoryName).toBe('Housing');
    expect(n.splits).toHaveLength(2);
    expect(n.isManualCorrection).toBe(true);
  });

  it('PATCH validation and reviewed flag', async () => {
    const mystery = (
      await ctx.http().get('/api/transactions?needsReview=true').expect(200)
    ).body;
    expect(mystery.map((t: any) => t.description)).toEqual([
      'Mystery Merchant',
    ]);
    await ctx
      .http()
      .patch(`/api/transactions/${mystery[0].id}`)
      .send({})
      .expect(400);
    await ctx
      .http()
      .patch(`/api/transactions/${mystery[0].id}`)
      .send({ categoryId: 'x' })
      .expect(400);
    await ctx
      .http()
      .patch(`/api/transactions/${mystery[0].id}`)
      .send({ categoryId: 99999 })
      .expect(400);
    await ctx
      .http()
      .patch(`/api/transactions/999999`)
      .send({ categoryId: null })
      .expect(404);
    const r = await ctx
      .http()
      .patch(`/api/transactions/${mystery[0].id}`)
      .send({ reviewed: true })
      .expect(200);
    expect(r.body).toMatchObject({
      needsReview: false,
      isManualCorrection: false,
      categoryName: 'Other',
    });
    const cleared = await ctx
      .http()
      .patch(`/api/transactions/${mystery[0].id}`)
      .send({ categoryId: null })
      .expect(200);
    expect(cleared.body).toMatchObject({
      categoryId: null,
      isManualCorrection: true,
    });
    const unc = (
      await ctx.http().get('/api/transactions?uncategorized=true').expect(200)
    ).body;
    expect(unc.map((t: any) => t.id)).toEqual([mystery[0].id]);
  });

  it('PUT splits: validation 400s, success, and empty array clears', async () => {
    const payroll = (
      await ctx.http().get('/api/transactions?search=payroll').expect(200)
    ).body[0];
    const cats = (await ctx.http().get('/api/categories').expect(200)).body;
    const id = (n: string) => cats.find((c: any) => c.name === n).id;
    const put = (splits: unknown) =>
      ctx.http().put(`/api/transactions/${payroll.id}/splits`).send({ splits });

    await put([
      { categoryId: id('Income'), amount: 2000 },
      { categoryId: id('Other'), amount: 400 },
    ]).expect(400); // sum
    await put([
      { categoryId: id('Income'), amount: 2600 },
      { categoryId: id('Other'), amount: -100 },
    ]).expect(400); // sign
    await put([{ categoryId: 99999, amount: 2500 }]).expect(400); // unknown category
    await put([{ categoryId: id('Income'), amount: 'x' }]).expect(400); // validation
    await ctx
      .http()
      .put(`/api/transactions/${payroll.id}/splits`)
      .send({})
      .expect(400);

    const ok = await put([
      { categoryId: id('Income'), amount: 2000.01 },
      { categoryId: id('Other'), amount: 499.99 },
    ]).expect(200);
    expect(ok.body.splits).toEqual([
      expect.objectContaining({ categoryName: 'Income', amount: 2000.01 }),
      expect.objectContaining({ categoryName: 'Other', amount: 499.99 }),
    ]);
    expect(ok.body.isManualCorrection).toBe(true);
    const filtered = (
      await ctx
        .http()
        .get(`/api/transactions?categoryId=${id('Other')}&month=2024-01`)
        .expect(200)
    ).body;
    expect(filtered.some((t: any) => t.id === payroll.id)).toBe(true);
    const cleared = await put([]).expect(200);
    expect(cleared.body.splits).toEqual([]);
  });

  it('409 when a job for the same month is already queued/running', async () => {
    await ctx.db.query(
      `UPDATE transactions SET category_id = NULL WHERE NOT is_manual_correction AND statement_month = '2024-01'`,
    );
    const release = ctx.llm.hold();
    const first = await ctx
      .http()
      .post('/api/jobs/process')
      .send({ month: '2024-01' })
      .expect(202);
    await ctx
      .http()
      .post('/api/jobs/process')
      .send({ month: '2024-01' })
      .expect(409);
    // A different month is fine.
    const other = await ctx
      .http()
      .post('/api/jobs/process')
      .send({ month: '2024-02' })
      .expect(202);
    release();
    expect((await waitForJob(ctx, first.body.id)).status).toBe('completed');
    expect((await waitForJob(ctx, other.body.id)).status).toBe('completed');
    const jobs = (
      await ctx.http().get('/api/jobs?month=2024-01&limit=2').expect(200)
    ).body;
    expect(jobs).toHaveLength(2);
    expect(jobs[0].id).toBe(first.body.id);
    await ctx
      .http()
      .post('/api/jobs/process')
      .send({ month: '2024-1' })
      .expect(400);
    await ctx
      .http()
      .post('/api/jobs/process')
      .send({ month: '2024-01', mode: 'everything' })
      .expect(400);
    await ctx.http().get('/api/jobs/99999').expect(404);
  });

  it('job progress is monotonic and never exceeds 100%', async () => {
    await ctx.db.query(
      `UPDATE transactions SET category_id = NULL WHERE NOT is_manual_correction AND statement_month = '2024-01'`,
    );
    const snapshots: { total: number; processed: number }[] = [];
    const original = ctx.db.query.bind(ctx.db);
    const spy = jest
      .spyOn(ctx.db, 'query')
      .mockImplementation((sql: string, params?: unknown[]) => {
        if (/^\s*UPDATE processing_jobs SET total = \$2/.test(sql) && params) {
          snapshots.push({
            total: params[1] as number,
            processed: params[2] as number,
          });
        }
        return original(sql, params);
      });
    const job = await processMonth(ctx, '2024-01');
    spy.mockRestore();
    expect(job.status).toBe('completed');
    expect(snapshots.length).toBeGreaterThan(3);
    let prevProcessed = 0;
    let prevRatio = 0;
    for (const s of snapshots) {
      expect(s.processed).toBeGreaterThanOrEqual(prevProcessed);
      expect(s.processed).toBeLessThanOrEqual(s.total);
      const ratio = s.total ? s.processed / s.total : 0;
      expect(ratio).toBeGreaterThanOrEqual(prevRatio);
      prevProcessed = s.processed;
      prevRatio = ratio;
    }
    expect(job.processed).toBe(job.total);
  });

  it('LLM timeouts: a batch is retried once, then left uncategorized for review without failing the job', async () => {
    const reset = () =>
      ctx.db.query(
        `UPDATE transactions SET category_id = NULL, needs_review = false WHERE NOT is_manual_correction AND statement_month = '2024-01'`,
      );
    await reset();
    ctx.llm.failNext = [new LlmTimeoutError('fake timeout')];
    const retried = await processMonth(ctx, '2024-01');
    expect(retried).toMatchObject({ status: 'completed', errors: [] });
    const stillOpen = (
      await ctx
        .http()
        .get('/api/transactions?month=2024-01&uncategorized=true')
        .expect(200)
    ).body;
    expect(stillOpen.filter((t: any) => !t.isManualCorrection)).toHaveLength(0);

    await reset();
    ctx.llm.failNext = [
      new LlmTimeoutError('fake timeout'),
      new LlmTimeoutError('fake timeout'),
    ];
    const job = await processMonth(ctx, '2024-01');
    expect(job.status).toBe('completed');
    expect(job.errors).toEqual([
      expect.objectContaining({
        message: expect.stringMatching(/timed out twice/),
      }),
    ]);
    expect(job.processed).toBe(job.total);
    const left = (
      await ctx
        .http()
        .get('/api/transactions?month=2024-01&uncategorized=true')
        .expect(200)
    ).body.filter((t: any) => !t.isManualCorrection);
    expect(left.length).toBeGreaterThan(0);
    expect(left.every((t: any) => t.needsReview)).toBe(true);
    ctx.llm.failNext = [];
  });

  it('fails the job with a clear message when the LLM is unreachable', async () => {
    await ctx.db.query(
      `UPDATE transactions SET category_id = NULL WHERE NOT is_manual_correction AND statement_month = '2024-01'`,
    );
    ctx.llm.unavailable = true;
    const job = await processMonth(ctx, '2024-01');
    ctx.llm.unavailable = false;
    expect(job.status).toBe('failed');
    expect(job.message).toMatch(/not reachable/);
    const health = (await ctx.http().get('/api/health').expect(200)).body;
    expect(health).toEqual({
      db: 'ok',
      ollama: 'ok',
      model: 'fake-llm',
      modelAvailable: true,
    });
  });

  it('marks stale queued/running jobs as failed on boot', async () => {
    await ctx.db.query(
      `INSERT INTO processing_jobs (type, month, mode, status) VALUES ('process_month', '2030-01', 'incremental', 'running')`,
    );
    await ctx.jobs.onApplicationBootstrap();
    const jobs = (await ctx.http().get('/api/jobs?month=2030-01').expect(200))
      .body;
    expect(jobs[0]).toMatchObject({
      status: 'failed',
      message: 'Server restarted',
    });
  });

  it('DELETE statement removes the file but keeps its transactions', async () => {
    const files = (
      await ctx.http().get('/api/statements?month=2024-01').expect(200)
    ).body;
    const pdf = files.find((f: any) => f.fileName.endsWith('.pdf'));
    await ctx.http().delete(`/api/statements/${pdf.id}`).expect(204);
    await ctx.http().delete(`/api/statements/${pdf.id}`).expect(404);
    const after = (
      await ctx.http().get('/api/statements?month=2024-01').expect(200)
    ).body;
    expect(after.some((f: any) => f.id === pdf.id)).toBe(false);
    expect(
      (await ctx.http().get('/api/transactions?month=2024-01').expect(200))
        .body,
    ).toHaveLength(9);
  });
});
