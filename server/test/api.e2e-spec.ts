import { LlmTimeoutError } from '../src/llm/llm-client';
import { createTestApp, processMonth, TestContext } from './utils';

const ROWS = [
  '2024-03-01 Employer Payroll 3,000.00',
  '2024-03-02 Kroger Grocery -120.00',
  '2024-03-03 Walmart Supercenter -80.00',
  '2024-03-04 Mystery Merchant -20.00',
  '2024-03-05 ONLINE TRANSFER TO SAVINGS -500.00',
].join('\n');

describe('categories, accounts, budget, insights (e2e)', () => {
  let ctx: TestContext;
  let cats: Record<string, any>;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx
      .http()
      .post('/api/statements/upload')
      .attach('files', Buffer.from(ROWS), 'Main_Checking_2024-03.txt')
      .expect(201);
    const job = await processMonth(ctx, '2024-03');
    expect(job.status).toBe('completed');
    const list = (await ctx.http().get('/api/categories').expect(200))
      .body as any[];
    cats = Object.fromEntries(list.map((c) => [c.name, c]));
  });
  afterAll(async () => {
    await ctx.jobs.waitForIdle();
    await ctx.app.close();
  });

  it('seeds the default categories with income/transfer flags', () => {
    expect(Object.keys(cats).sort()).toEqual(
      [
        'Entertainment',
        'Food',
        'Housing',
        'Income',
        'Other',
        'Restaurants',
        'Shopping',
        'Transfer',
        'Transport',
        'Utilities',
      ].sort(),
    );
    expect(cats.Income).toMatchObject({
      isIncome: true,
      isTransfer: false,
    });
    expect(cats.Income).not.toHaveProperty('budgetLimit');
    expect(cats.Transfer).toMatchObject({ isIncome: false, isTransfer: true });
    expect(cats.Food.transactionCount).toBe(1);
  });

  it('categories CRUD with 409s', async () => {
    await ctx.http().post('/api/categories').send({ name: 'Food' }).expect(409);
    await ctx.http().post('/api/categories').send({ name: '' }).expect(400);
    await ctx
      .http()
      .post('/api/categories')
      .send({ name: 'Pets', isIncome: 'x' })
      .expect(400);
    const pets = (
      await ctx
        .http()
        .post('/api/categories')
        .send({ name: 'Pets', budgetLimit: 50 })
        .expect(201)
    ).body;
    // budgetLimit is gone from the Category API (section H): stripped by the whitelist, never returned.
    expect(pets).not.toHaveProperty('budgetLimit');
    expect(pets).toMatchObject({
      name: 'Pets',
      isIncome: false,
      isTransfer: false,
      transactionCount: 0,
    });
    const upd = (
      await ctx
        .http()
        .patch(`/api/categories/${pets.id}`)
        .send({ budgetLimit: 75.5, name: 'Pet Care' })
        .expect(200)
    ).body;
    expect(upd).toMatchObject({ name: 'Pet Care' });
    expect(upd).not.toHaveProperty('budgetLimit');
    // isTransfer is accepted on PATCH and POST (client sends it).
    const asTransfer = (
      await ctx
        .http()
        .patch(`/api/categories/${pets.id}`)
        .send({ isTransfer: true })
        .expect(200)
    ).body;
    expect(asTransfer).toMatchObject({ isTransfer: true, isIncome: false });
    await ctx
      .http()
      .patch(`/api/categories/${pets.id}`)
      .send({ isTransfer: 'yes' })
      .expect(400);
    const moves = (
      await ctx
        .http()
        .post('/api/categories')
        .send({ name: 'Moves', isTransfer: true })
        .expect(201)
    ).body;
    expect(moves.isTransfer).toBe(true);
    await ctx.http().delete(`/api/categories/${moves.id}`).expect(204);
    await ctx
      .http()
      .patch(`/api/categories/${pets.id}`)
      .send({ name: 'Food' })
      .expect(409);
    await ctx.http().delete(`/api/categories/${cats.Food.id}`).expect(409);
    await ctx.http().delete(`/api/categories/${pets.id}`).expect(204);
    await ctx
      .http()
      .patch(`/api/categories/${pets.id}`)
      .send({ budgetLimit: 1 })
      .expect(404);
  });

  it('accounts list and rename (409 on duplicate)', async () => {
    const accounts = (await ctx.http().get('/api/accounts').expect(200)).body;
    expect(accounts).toEqual([
      {
        id: expect.any(Number),
        accountName: 'Main Checking',
        accountType: 'Bank',
      },
    ]);
    const renamed = await ctx
      .http()
      .patch(`/api/accounts/${accounts[0].id}`)
      .send({ accountName: 'Everyday Checking' })
      .expect(200);
    expect(renamed.body.accountName).toBe('Everyday Checking');
    await ctx
      .http()
      .patch(`/api/accounts/${accounts[0].id}`)
      .send({ accountName: 'Main Checking' })
      .expect(200);
  });

  it('upload: a YYYY-MM in the file name wins over the month field', async () => {
    const res = await ctx
      .http()
      .post('/api/statements/upload')
      .field('month', '2024-05')
      .attach(
        'files',
        Buffer.from('2024-04-02 X -1.00'),
        'Side_Account_2024-04.txt',
      )
      .attach('files', Buffer.from('2024-05-02 Y -1.00'), 'Side_Account.txt')
      .expect(201);
    expect(res.body.map((f: any) => f.month)).toEqual(['2024-04', '2024-05']);
    for (const f of res.body)
      await ctx.http().delete(`/api/statements/${f.id}`).expect(204);
  });

  it('budget summary: splits-aware, transfers and income excluded from spending', async () => {
    await ctx
      .http()
      .put(`/api/budget/main/items/${cats.Food.id}`)
      .send({ amount: 200, effectiveFrom: '2024-03' })
      .expect(200);
    const walmart = (
      await ctx.http().get('/api/transactions?search=walmart').expect(200)
    ).body[0];
    expect(walmart.categoryName).toBe('Shopping');
    await ctx
      .http()
      .put(`/api/transactions/${walmart.id}/splits`)
      .send({
        splits: [
          { categoryId: cats.Food.id, amount: -50 },
          { categoryId: cats.Shopping.id, amount: -30 },
        ],
      })
      .expect(200);

    const s = (
      await ctx.http().get('/api/budget/summary?month=2024-03').expect(200)
    ).body;
    expect(s).toMatchObject({
      month: '2024-03',
      totalIncome: 3000,
      totalSpent: 220,
      net: 2780,
      uncategorizedSpent: 0,
    });
    const line = (n: string) => s.categories.find((c: any) => c.name === n);
    expect(line('Food')).toEqual({
      categoryId: cats.Food.id,
      name: 'Food',
      budgetLimit: 200,
      spent: 170,
      remaining: 30,
      percentUsed: 85,
      isIncome: false,
      isTransfer: false,
    });
    expect(line('Shopping')).toMatchObject({ spent: 30, percentUsed: null });
    expect(line('Other')).toMatchObject({ spent: 20 });
    expect(line('Income')).toMatchObject({ spent: 3000, isIncome: true });
    expect(line('Transfer')).toMatchObject({ spent: 500, isTransfer: true });
    expect(s.categories[s.categories.length - 1].isTransfer).toBe(true);

    // Un-categorize the mystery row → shows up as uncategorizedSpent.
    const mystery = (
      await ctx.http().get('/api/transactions?search=mystery').expect(200)
    ).body[0];
    await ctx
      .http()
      .patch(`/api/transactions/${mystery.id}`)
      .send({ categoryId: null })
      .expect(200);
    const s2 = (
      await ctx.http().get('/api/budget/summary?month=2024-03').expect(200)
    ).body;
    expect(s2.uncategorizedSpent).toBe(20);
    expect(s2.totalSpent).toBe(220);
    expect(s2.categories.find((c: any) => c.name === 'Other').spent).toBe(0);

    await ctx.http().get('/api/budget/summary').expect(400);
  });

  it('budget trend: N calendar months ending at the latest month, oldest first', async () => {
    const t = (await ctx.http().get('/api/budget/trend?months=3').expect(200))
      .body;
    expect(t.map((p: any) => p.month)).toEqual([
      '2024-01',
      '2024-02',
      '2024-03',
    ]);
    expect(t[0]).toEqual({
      month: '2024-01',
      totalIncome: 0,
      totalSpent: 0,
      totalBudgeted: 0,
      byCategory: {},
    });
    expect(t[2]).toEqual({
      month: '2024-03',
      totalIncome: 3000,
      totalSpent: 220,
      totalBudgeted: 200,
      byCategory: { Food: 170, Shopping: 30 },
    });
    const anchored = (
      await ctx
        .http()
        .get('/api/budget/trend?months=2&month=2024-04')
        .expect(200)
    ).body;
    expect(anchored.map((p: any) => p.month)).toEqual(['2024-03', '2024-04']);
    await ctx.http().get('/api/budget/trend?months=0').expect(400);
  });

  it('insights: null when none, generate with fake LLM (unknown categories dropped), 503 when LLM down', async () => {
    const none = await ctx
      .http()
      .get('/api/insights?month=2024-03')
      .expect(200);
    expect(none.body).toBeNull();
    expect(none.text).toBe('null');

    const gen = (
      await ctx
        .http()
        .post('/api/insights/generate')
        .send({ month: '2024-03' })
        .expect(201)
    ).body;
    expect(gen).toMatchObject({
      month: '2024-03',
      summary: 'Fake summary: spending was steady.',
      model: 'fake-llm',
      suggestions: [
        {
          categoryId: cats.Food.id,
          categoryName: 'Food',
          suggestedLimit: 400,
          reason: 'average',
        },
      ],
    });
    const prompt = ctx.llm.calls.filter((c) => c.task === 'insights').pop()!
      .prompt;
    expect(prompt).toContain('2024-03');
    expect(prompt).not.toMatch(/categoryName":"Transfer/);

    const latest = (
      await ctx.http().get('/api/insights?month=2024-03').expect(200)
    ).body;
    expect(latest.id).toBe(gen.id);

    ctx.llm.unavailable = true;
    await ctx
      .http()
      .post('/api/insights/generate')
      .send({ month: '2024-03' })
      .expect(503);
    ctx.llm.unavailable = false;
    ctx.llm.failNext = [new LlmTimeoutError('took 180s')];
    const timeout = await ctx
      .http()
      .post('/api/insights/generate')
      .send({ month: '2024-03' })
      .expect(504);
    expect(timeout.body.message).toMatch(/took too long/);
    await ctx
      .http()
      .post('/api/insights/generate')
      .send({ month: 'March' })
      .expect(400);
  });
});
