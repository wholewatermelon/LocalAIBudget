import { createTestApp, processMonth, TestContext } from './utils';

/** Main budget (versioned) + month adjustments — ARCHITECTURE.md section H. */
describe('main budget + month adjustments (e2e)', () => {
  let ctx: TestContext;
  let id: Record<string, number>;

  const main = async (month: string) =>
    (await ctx.http().get(`/api/budget/main?month=${month}`).expect(200)).body;
  const monthView = async (month: string) =>
    (await ctx.http().get(`/api/budget/month?month=${month}`).expect(200)).body;
  const putMain = (cat: string, amount: number | null, effectiveFrom: string) =>
    ctx
      .http()
      .put(`/api/budget/main/items/${id[cat]}`)
      .send({ amount, effectiveFrom });
  const putMonth = (month: string, cat: string, body: object) =>
    ctx.http().put(`/api/budget/month/${month}/items/${id[cat]}`).send(body);
  const item = (view: any, cat: string) =>
    view.items.find((i: any) => i.categoryName === cat);

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx
      .http()
      .post('/api/statements/upload')
      .attach(
        'files',
        Buffer.from(
          '2024-01-03 Kroger Grocery -120.00\n2024-01-04 Walmart -80.00\n2024-01-05 Employer Payroll 3,000.00',
        ),
        'Main_Checking_2024-01.txt',
      )
      .attach(
        'files',
        Buffer.from(
          '2024-03-03 Kroger Grocery -60.00\n2024-03-04 Walmart -210.00\n2024-03-05 Netflix -15.99',
        ),
        'Main_Checking_2024-03.txt',
      )
      .expect(201);
    expect((await processMonth(ctx, '2024-01')).status).toBe('completed');
    expect((await processMonth(ctx, '2024-03')).status).toBe('completed');
    const cats = (await ctx.http().get('/api/categories').expect(200))
      .body as any[];
    id = Object.fromEntries(cats.map((c) => [c.name, c.id]));
  });
  afterAll(async () => {
    await ctx.jobs.waitForIdle();
    await ctx.app.close();
  });

  it('main budget: versioned upserts, history, removal tombstones, undo, validation', async () => {
    const r1 = (await putMain('Food', 400, '2024-01').expect(200)).body;
    expect(r1).toEqual({
      month: '2024-01',
      items: [
        {
          categoryId: id.Food,
          categoryName: 'Food',
          amount: 400,
          effectiveFrom: '2024-01',
          hasLaterChange: false,
        },
      ],
      total: 400,
    });
    await putMain('Food', 450, '2024-03').expect(200);
    await putMain('Shopping', 100, '2024-01').expect(200);
    await putMain('Shopping', null, '2024-03').expect(200); // removed from main from March

    const jan = await main('2024-01');
    expect(item(jan, 'Food')).toMatchObject({
      amount: 400,
      hasLaterChange: true,
    });
    expect(jan.total).toBe(500);
    const mar = await main('2024-03');
    expect(
      mar.items.map((i: any) => [i.categoryName, i.amount, i.effectiveFrom]),
    ).toEqual([['Food', 450, '2024-03']]);
    expect((await main('2023-12')).items).toEqual([]);

    const history = (
      await ctx
        .http()
        .get(`/api/budget/main/history?categoryId=${id.Shopping}`)
        .expect(200)
    ).body;
    expect(history.map((h: any) => [h.effectiveFrom, h.amount])).toEqual([
      ['2024-01', 100],
      ['2024-03', null],
    ]);
    expect(typeof history[0].createdAt).toBe('string');

    await ctx
      .http()
      .delete(`/api/budget/main/items/${id.Food}/versions/2024-03`)
      .expect(204);
    await ctx
      .http()
      .delete(`/api/budget/main/items/${id.Food}/versions/2024-03`)
      .expect(404);
    expect(item(await main('2024-03'), 'Food')).toMatchObject({
      amount: 400,
      effectiveFrom: '2024-01',
    });

    await putMain('Income', 100, '2024-01').expect(400);
    await putMain('Transfer', 100, '2024-01').expect(400);
    await ctx
      .http()
      .put('/api/budget/main/items/99999')
      .send({ amount: 1, effectiveFrom: '2024-01' })
      .expect(404);
    await putMain('Food', -5, '2024-01').expect(400);
    await ctx
      .http()
      .put(`/api/budget/main/items/${id.Food}`)
      .send({ amount: 5 })
      .expect(400);
    await ctx
      .http()
      .put(`/api/budget/main/items/${id.Food}`)
      .send({ effectiveFrom: '2024-01' })
      .expect(400);
    await ctx.http().get('/api/budget/main').expect(400);
    await ctx
      .http()
      .delete(`/api/budget/main/items/${id.Food}/versions/2024-1`)
      .expect(400);
  });

  it('month view: adjusted, month-only, hidden, unbudgeted; reset to main; validation', async () => {
    let v = await monthView('2024-03');
    expect(item(v, 'Food')).toEqual({
      categoryId: id.Food,
      categoryName: 'Food',
      mainAmount: 400,
      adjustedAmount: null,
      hidden: false,
      note: null,
      effectiveAmount: 400,
      source: 'main',
      spent: 60,
      remaining: 340,
    });
    expect(item(v, 'Shopping')).toMatchObject({
      source: 'unbudgeted',
      mainAmount: null,
      effectiveAmount: null,
      spent: 210,
      remaining: null,
    });
    expect(item(v, 'Income')).toBeUndefined(); // only spending categories
    expect(item(v, 'Housing')).toBeUndefined(); // no budget, no spending

    v = (
      await putMonth('2024-03', 'Food', { amount: 500, note: 'guests' }).expect(
        200,
      )
    ).body;
    expect(item(v, 'Food')).toMatchObject({
      mainAmount: 400,
      adjustedAmount: 500,
      effectiveAmount: 500,
      source: 'adjusted',
      note: 'guests',
      remaining: 440,
    });
    v = (await putMonth('2024-03', 'Entertainment', { amount: 20 }).expect(200))
      .body;
    expect(item(v, 'Entertainment')).toMatchObject({
      mainAmount: null,
      effectiveAmount: 20,
      source: 'month-only',
      spent: 15.99,
      remaining: 4.01,
    });
    v = (await putMonth('2024-03', 'Shopping', { hidden: true }).expect(200))
      .body;
    expect(item(v, 'Shopping')).toMatchObject({
      hidden: true,
      effectiveAmount: null,
      source: 'hidden',
      remaining: null,
    });
    v = (await putMonth('2024-03', 'Food', { note: 'party' }).expect(200)).body; // note-only edit keeps the amount
    expect(item(v, 'Food')).toMatchObject({
      adjustedAmount: 500,
      note: 'party',
    });
    expect(v).toMatchObject({
      month: '2024-03',
      totalBudgeted: 520,
      totalSpent: 285.99,
    });

    await putMonth('2024-03', 'Housing', {}).expect(400); // amount required unless hidden
    await putMonth('2024-03', 'Income', { amount: 5 }).expect(400);
    await putMonth('2024-03', 'Food', { amount: -1 }).expect(400);
    await ctx
      .http()
      .put(`/api/budget/month/2024-3/items/${id.Food}`)
      .send({ amount: 1 })
      .expect(400);
    await ctx
      .http()
      .put('/api/budget/month/2024-03/items/99999')
      .send({ amount: 1 })
      .expect(404);

    v = (
      await ctx
        .http()
        .delete(`/api/budget/month/2024-03/items/${id.Food}`)
        .expect(200)
    ).body;
    expect(item(v, 'Food')).toMatchObject({
      source: 'main',
      effectiveAmount: 400,
      adjustedAmount: null,
      note: null,
    });
  });

  it('summary and trend use the effective budget', async () => {
    const s = (
      await ctx.http().get('/api/budget/summary?month=2024-03').expect(200)
    ).body;
    const line = (n: string) => s.categories.find((c: any) => c.name === n);
    expect(line('Food')).toMatchObject({
      budgetLimit: 400,
      spent: 60,
      remaining: 340,
      percentUsed: 15,
    });
    expect(line('Entertainment')).toMatchObject({
      budgetLimit: 20,
      percentUsed: 80,
    });
    expect(line('Shopping')).toMatchObject({
      budgetLimit: null,
      remaining: null,
      percentUsed: null,
    }); // hidden
    expect(line('Income')).toMatchObject({ budgetLimit: null });
    const jan = (
      await ctx.http().get('/api/budget/summary?month=2024-01').expect(200)
    ).body;
    expect(
      jan.categories.find((c: any) => c.name === 'Shopping'),
    ).toMatchObject({ budgetLimit: 100, spent: 80 });

    const trend = (
      await ctx
        .http()
        .get('/api/budget/trend?months=3&month=2024-03')
        .expect(200)
    ).body;
    expect(trend.map((p: any) => [p.month, p.totalBudgeted])).toEqual([
      ['2024-01', 500],
      ['2024-02', 500],
      ['2024-03', 420],
    ]);
  });

  it('copy-adjustments copies only missing adjustments', async () => {
    await putMonth('2024-04', 'Entertainment', { amount: 99 }).expect(200);
    const v = (
      await ctx
        .http()
        .post('/api/budget/month/2024-04/copy-adjustments')
        .send({ fromMonth: '2024-03' })
        .expect(200)
    ).body;
    expect(item(v, 'Entertainment')).toMatchObject({
      effectiveAmount: 99,
      source: 'month-only',
    }); // not overwritten
    expect(item(v, 'Shopping')).toMatchObject({
      hidden: true,
      source: 'hidden',
    });
    expect(item(v, 'Food')).toMatchObject({ source: 'main' }); // Food's March adjustment was reset
    await ctx
      .http()
      .post('/api/budget/month/2024-04/copy-adjustments')
      .send({ fromMonth: '2024-04' })
      .expect(400);
    await ctx
      .http()
      .post('/api/budget/month/2024-04/copy-adjustments')
      .send({})
      .expect(400);
  });

  it('seed preview (actual / average / budget) writes nothing; seed replaces main from effectiveFrom', async () => {
    await putMain('Housing', 2000, '2024-01').expect(200);
    const preview = (body: object) =>
      ctx.http().post('/api/budget/main/seed/preview').send(body).expect(200);

    const actual = (
      await preview({
        fromMonth: '2024-03',
        source: 'actual',
        effectiveFrom: '2024-05',
      })
    ).body;
    expect(actual.items).toEqual([
      {
        categoryId: id.Entertainment,
        categoryName: 'Entertainment',
        amount: 25,
        currentMainAmount: null,
      },
      {
        categoryId: id.Food,
        categoryName: 'Food',
        amount: 75,
        currentMainAmount: 400,
      },
      {
        categoryId: id.Shopping,
        categoryName: 'Shopping',
        amount: 225,
        currentMainAmount: null,
      },
    ]);
    expect(actual.total).toBe(325);

    // Average of Jan–Mar; February has no transactions and is skipped.
    const avg = (
      await preview({
        fromMonth: '2024-03',
        source: 'average',
        averageMonths: 3,
        roundTo: 10,
        effectiveFrom: '2024-05',
      })
    ).body;
    expect(avg.items.map((i: any) => [i.categoryName, i.amount])).toEqual([
      ['Entertainment', 10],
      ['Food', 90],
      ['Shopping', 150],
    ]);

    // Effective budget of March: Food 400 (main), Entertainment 20 (month-only), Housing 2000; Shopping hidden.
    const budget = (
      await preview({
        fromMonth: '2024-03',
        source: 'budget',
        roundTo: 1,
        effectiveFrom: '2024-05',
      })
    ).body;
    expect(budget.items.map((i: any) => [i.categoryName, i.amount])).toEqual([
      ['Entertainment', 20],
      ['Food', 400],
      ['Housing', 2000],
    ]);
    expect(
      (await main('2024-05')).items.map((i: any) => i.categoryName),
    ).toEqual(['Food', 'Housing']); // no writes

    await ctx
      .http()
      .post('/api/budget/main/seed/preview')
      .send({ fromMonth: '2024-03', source: 'guess', effectiveFrom: '2024-05' })
      .expect(400);
    await ctx
      .http()
      .post('/api/budget/main/seed/preview')
      .send({
        fromMonth: '2024-03',
        source: 'actual',
        roundTo: 7,
        effectiveFrom: '2024-05',
      })
      .expect(400);
    await ctx
      .http()
      .post('/api/budget/main/seed/preview')
      .send({ fromMonth: '2024-03', source: 'actual' })
      .expect(400);

    const seeded = (
      await ctx
        .http()
        .post('/api/budget/main/seed')
        .send({
          fromMonth: '2024-03',
          source: 'actual',
          effectiveFrom: '2024-05',
        })
        .expect(200)
    ).body;
    expect(seeded.month).toBe('2024-05');
    expect(
      seeded.items.map((i: any) => [i.categoryName, i.amount, i.effectiveFrom]),
    ).toEqual([
      ['Entertainment', 25, '2024-05'],
      ['Food', 75, '2024-05'],
      ['Shopping', 225, '2024-05'],
    ]);
    expect(seeded.total).toBe(325);
    // Housing got a tombstone at 2024-05; earlier months unchanged.
    expect(item(await main('2024-04'), 'Housing')).toMatchObject({
      amount: 2000,
      hasLaterChange: true,
    });
    const housing = (
      await ctx
        .http()
        .get(`/api/budget/main/history?categoryId=${id.Housing}`)
        .expect(200)
    ).body;
    expect(housing.map((h: any) => [h.effectiveFrom, h.amount])).toEqual([
      ['2024-01', 2000],
      ['2024-05', null],
    ]);
  });

  it('insights prompt includes effective and main budgets', async () => {
    await ctx
      .http()
      .post('/api/insights/generate')
      .send({ month: '2024-03' })
      .expect(201);
    const prompt = ctx.llm.calls.filter((c) => c.task === 'insights').pop()!
      .prompt;
    expect(prompt).toContain(
      '"categoryName":"Entertainment","effective":20,"main":null',
    );
    expect(prompt).toContain('"categoryName":"Shopping","effective":null');
    expect(prompt).toContain(
      '"categoryName":"Food","effective":400,"main":400',
    );
  });
});
