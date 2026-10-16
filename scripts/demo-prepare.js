#!/usr/bin/env node
/*
 * Builds the demo database from scratch and snapshots it to demo/snapshot.sql (≈ 25-40 min, mostly Gemma).
 *
 *   npm run demo:prepare                      # everything
 *   node scripts/demo-prepare.js --from stage # resume at a phase: reset | generate | rules | process | stage | insight | budget | dump
 *
 * Needs the dev servers running (`npm run dev`) and Ollama with gemma4. Uses only 127.0.0.1 (API, Ollama, Postgres).
 * Phases:
 *   reset    server CLI `db:reset --yes` (drop + recreate public schema, migrate)
 *   generate generate-fake-statements --demo (data/statements 2024-08..2025-02, demo/upload/)
 *   rules    8 pre-staged rules (no coffee rule — that one is created live)
 *   process  POST /jobs/process for every month, sequentially (real Gemma); retries "Server restarted"
 *   stage    curation: coffee rows = Food/ai, review queue, manual corrections, a split
 *   insight  POST /insights/generate for 2025-01 (real Gemma), before budgets so it reasons from spending
 *   budget   main budget 2024-08 + 2024-11 version, December adjustments (Holiday Gifts month-only, Food)
 *   dump     pg_dump -> demo/snapshot.sql
 */
'use strict';

const { spawnSync } = require('child_process');
const L = require('./demo-lib');
const { log, api, sql, elapsed } = L;

const PHASES = ['reset', 'generate', 'rules', 'process', 'stage', 'insight', 'budget', 'dump'];
const fromArg = process.argv.indexOf('--from');
const FROM = fromArg > 0 ? process.argv[fromArg + 1] : 'reset';
if (!PHASES.includes(FROM)) throw new Error(`--from must be one of ${PHASES.join(', ')}`);
const run = (phase) => PHASES.indexOf(phase) >= PHASES.indexOf(FROM);

const STAGED_RULES = [
  ['AMZN MKTP', 'Shopping'],
  ['SHELL OIL', 'Transport'],
  ['PAYROLL', 'Income'],
  ['DIR DEP', 'Income'],
  ['PINECREST HOME LOANS', 'Housing'],
  ['CASCADE POWER & LIGHT', 'Utilities'],
  ['NETFLIX', 'Entertainment'],
  ['COSTCO WHSE', 'Food'],
];

/**
 * Deterministic clean-up of Gemma's output so the dashboard is credible. Applied only to rows Gemma categorized
 * (categorized_by = 'ai'); they stay marked 'ai'. Pattern = substring of the description (case-insensitive).
 */
const CURATION = [
  // coffee: the demo story needs Gemma's "Food" here (step 2 corrects it to Restaurants)
  ['BLUE BOTTLE COFFEE', 'Food'],
  ['STARBUCKS', 'Restaurants'], ['DUTCH BROS', 'Restaurants'], ['CASCADE ROASTERS', 'Restaurants'],
  ['TST* ', 'Restaurants'], ['SQ *TACO PEDRO', 'Restaurants'], ['OLIVE GARDEN', 'Restaurants'], ['PIZZICATO', 'Restaurants'],
  ['CHIPOTLE', 'Restaurants'], ['MCDONALD', 'Restaurants'], ['SUBWAY', 'Restaurants'], ['DOORDASH', 'Restaurants'],
  ['UBER *EATS', 'Restaurants'], ['PANDA EXPRESS', 'Restaurants'],
  ['SAFEWAY', 'Food'], ['NEW SEASONS', 'Food'], ['WINCO', 'Food'], ['TRADER JOE', 'Food'], ['GROCERY OUTLET', 'Food'],
  ['FRED-MEYER #', 'Food'],
  ['CHEVRON', 'Transport'], ['ARCO', 'Transport'], ['FRED-MEYER FUEL', 'Transport'], ['COSTCO GAS', 'Transport'],
  ['LYFT', 'Transport'], ['ALASKA AIR', 'Transport'],
  ['SPOTIFY', 'Entertainment'], ['DISNEY PLUS', 'Entertainment'], ['HULU', 'Entertainment'], ['APPLE.COM/BILL', 'Entertainment'],
  ['WHISTLER', 'Entertainment'], ['LITTLE STARS DANCE', 'Entertainment'], ['PARKS & REC', 'Entertainment'], ['YMCA', 'Entertainment'],
  ['FAIRVIEW CITY UTILITIES', 'Utilities'], ['RIVERNET', 'Utilities'], ['VELOCITY WIRELESS', 'Utilities'],
  ['EVERGREEN MUTUAL', 'Housing'],
  ['TARGET', 'Shopping'], ['KOHL', 'Shopping'], ['REI #', 'Shopping'], ['POWELL', 'Shopping'], ['BEST BUY', 'Shopping'],
  ['ETSY', 'Shopping'], ['HOME DEPOT', 'Shopping'], ['CHEWY', 'Shopping'], ['SMITH & SONS', 'Shopping'], ['DOLLAR TREE', 'Shopping'],
  ['GOODWILL', 'Shopping'],
  ['WALGREENS', 'Other'], ['CVS/PHARMACY', 'Other'], ['RITE AID', 'Other'],
  ['HARBORVIEW CONSULTING', 'Income'], ['VENMO CASHOUT', 'Income'], ['MOBILE DEPOSIT', 'Income'],
  ['INTEREST PAYMENT', 'Income'],
];

const MAIN_BUDGET_2024_08 = {
  Housing: 2600, Food: 3500, Restaurants: 1000, Transport: 900, Entertainment: 250, Utilities: 550, Shopping: 1000, Other: 450,
};
const MAIN_BUDGET_2024_11 = { Food: 3800, Restaurants: 900 }; // second version: "groceries went up, eat out less"

async function main() {
  const timings = {};
  const phase = async (name, fn) => {
    if (!run(name)) return;
    const s = Date.now();
    log(`== ${name}`);
    await fn();
    timings[name] = elapsed(s);
  };

  const h = await L.health();
  if (h.error || h.db !== 'ok') throw new Error(`API not healthy (${JSON.stringify(h)}) — start it with \`npm run dev\``);
  if ((await L.activeJobs()).length) throw new Error('A processing job is running — wait for it to finish first.');

  await phase('reset', async () => {
    const r = spawnSync('npm', ['--prefix', 'server', 'run', 'db:reset', '--', '--yes'], { cwd: L.ROOT, shell: true, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`db:reset failed: ${r.stdout}\n${r.stderr}`);
  });

  await phase('generate', async () => log(`  ${L.generateDemoStatements()} files`));

  const cats = async () => Object.fromEntries((await api('GET', '/categories')).map((c) => [c.name, c]));

  await phase('rules', async () => {
    const c = await cats();
    for (const [pattern, cat] of STAGED_RULES) await api('POST', '/rules', { pattern, matchType: 'contains', categoryId: c[cat].id });
    log(`  ${STAGED_RULES.length} rules`);
  });

  await phase('process', async () => {
    for (const m of L.DEMO_MONTHS) {
      const j = await L.processMonth(m, 'incremental', { retries: 5 });
      log(`  ${m}: inserted ${j.inserted}, rules ${j.rulesApplied}, transfers ${j.transfersMatched}, gemma ${j.categorized}, ` +
        `errors ${j.errors.length}, ${j.seconds.toFixed(0)}s`);
    }
  });

  await phase('stage', async () => {
    const c = await cats();
    const esc = (s) => s.replace(/'/g, "''");
    // 1. curation of Gemma output (stays categorized_by = 'ai')
    let fixed = 0;
    for (const [pat, cat] of CURATION) {
      const n = sql(`WITH u AS (UPDATE transactions SET category_id = ${c[cat].id}, updated_at = now()
        WHERE categorized_by = 'ai' AND description ILIKE '%${esc(pat).replace(/[%_]/g, '\\$&')}%' AND category_id IS DISTINCT FROM ${c[cat].id}
        RETURNING 1) SELECT count(*) FROM u`);
      fixed += Number(n);
    }
    log(`  curated ${fixed} Gemma rows`);
    // 2. review queue: clear everything, then flag a hand-picked handful in 2025-01 (Blue Bottle first)
    sql(`UPDATE transactions SET needs_review = false WHERE needs_review`);
    const pick = (where) => sql(`SELECT id FROM transactions WHERE transaction_date BETWEEN '2025-01-01' AND '2025-01-31' AND ${where}
      ORDER BY transaction_date DESC, id DESC LIMIT 1`);
    const review = [
      [pick(`description ILIKE '%BLUE BOTTLE COFFEE%'`), 0.62],
      [pick(`description ILIKE 'VENMO CASHOUT%'`), 0.55],
      [pick(`description ILIKE 'MOBILE DEPOSIT%'`), 0.6],
      [pick(`description ILIKE 'CHECK #%'`), 0.48],
    ].filter(([id]) => id);
    for (const [id, conf] of review) {
      const cat = sql(`SELECT c.name FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.id = ${id}`);
      const target = cat || 'Other';
      sql(`UPDATE transactions SET needs_review = true, ai_confidence = ${conf}, categorized_by = 'ai', category_id = ${c[target].id}
        WHERE id = ${id}`);
    }
    log(`  review queue 2025-01: ${review.length} rows`);
    // 3. manual corrections through the API (these also become Gemma's few-shot examples)
    await api('POST', '/categories', { name: 'Holiday Gifts', isIncome: false }, { okStatuses: [409] });
    const c2 = await cats();
    const tx = async (month, search) => (await api('GET', `/transactions?month=${month}&search=${encodeURIComponent(search)}`))[0];
    const corrections = [
      ['2024-12', 'BEST BUY', 'Holiday Gifts'],
      ['2024-12', 'CRAFTEDBYJUNE', 'Holiday Gifts'],
      ['2024-12', 'ALASKA AIR', 'Transport'],
      ['2024-12', 'WHISTLER BLACKCOMB', 'Entertainment'],
      ['2024-09', 'HOME DEPOT', 'Housing'],
    ];
    for (const [m, s, cat] of corrections) {
      const t = await tx(m, s);
      if (t) await api('PATCH', `/transactions/${t.id}`, { categoryId: c2[cat].id });
    }
    log(`  ${corrections.length} manual corrections`);
    // 4. a split: the biggest Costco run in January, groceries vs household goods
    const costco = (await api('GET', `/transactions?month=2025-01&search=${encodeURIComponent('COSTCO WHSE')}`))
      .filter((t) => t.amount < 0).sort((a, b) => a.amount - b.amount)[0];
    if (costco) {
      const shopping = Math.round(costco.amount * 0.35 * 100) / 100;
      const food = Math.round((costco.amount - shopping) * 100) / 100;
      await api('PUT', `/transactions/${costco.id}/splits`, { splits: [{ categoryId: c2.Food.id, amount: food }, { categoryId: c2.Shopping.id, amount: shopping }] });
      log(`  split ${costco.description} ${costco.amount} -> Food ${food} / Shopping ${shopping}`);
    }
  });

  await phase('insight', async () => {
    const s = Date.now();
    const ins = await api('POST', '/insights/generate', { month: '2025-01' }, { timeoutMs: 900000 });
    log(`  insight ${elapsed(s)}: ${ins.suggestions.length} suggestions — ${ins.summary.slice(0, 160)}…`);
  });

  // budgets come after the insight on purpose: the insight then reflects spending, not just echoing the budget
  await phase('budget', async () => {
    const c2 = await cats();
    // budgets: main from 2024-08, a second version from 2024-11, December adjustments
    for (const [cat, amount] of Object.entries(MAIN_BUDGET_2024_08)) await api('PUT', `/budget/main/items/${c2[cat].id}`, { amount, effectiveFrom: '2024-08' });
    for (const [cat, amount] of Object.entries(MAIN_BUDGET_2024_11)) await api('PUT', `/budget/main/items/${c2[cat].id}`, { amount, effectiveFrom: '2024-11' });
    await api('PUT', `/budget/month/2024-12/items/${c2['Holiday Gifts'].id}`, { amount: 500, note: 'Gifts for family and teachers' });
    await api('PUT', `/budget/month/2024-12/items/${c2.Food.id}`, { amount: 4200, note: 'Hosting the family for the holidays' });
    log('  budgets staged');
  });

  await phase('dump', async () => {
    const out = L.pgTool('pg_dump', ['-d', L.DB.database, '--no-owner', '--no-privileges', '--encoding=UTF8']);
    L.fs.mkdirSync(L.path.dirname(L.SNAPSHOT), { recursive: true });
    // strip the restrict/unrestrict lines newer pg_dump emits with a random key, so the snapshot only changes when data does
    L.fs.writeFileSync(L.SNAPSHOT, out.replace(/^\\(un)?restrict .*\r?\n/gm, ''));
    log(`  ${L.path.relative(L.ROOT, L.SNAPSHOT)} (${(out.length / 1024).toFixed(0)} KB)`);
  });

  console.log('\nTimings:', timings, `total ${elapsed()}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
