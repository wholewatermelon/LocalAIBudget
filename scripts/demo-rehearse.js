#!/usr/bin/env node
/*
 * Dry-runs demo steps 2-4 through the API exactly as the UI does them, with timings. Run right after `npm run demo:reset`
 * (it changes the DB — run demo:reset again afterwards).
 *   node scripts/demo-rehearse.js
 */
'use strict';

const L = require('./demo-lib');
const { log, api, elapsed } = L;

async function main() {
  const t = {};
  const cats = Object.fromEntries((await api('GET', '/categories')).map((c) => [c.name, c]));

  // ---- step 2: review & teach
  const queue = await api('GET', '/transactions?month=2025-01&needsReview=true');
  log(`review queue 2025-01: ${queue.length} rows: ${queue.map((x) => `${x.description} (${x.categoryName})`).join(' | ')}`);
  const coffee = queue.find((x) => /BLUE BOTTLE/.test(x.description));
  if (!coffee) throw new Error('no Blue Bottle row in the review queue');
  let s = Date.now();
  const patched = await api('PATCH', `/transactions/${coffee.id}`, { categoryId: cats.Restaurants.id });
  const sug = await api('GET', `/rules/suggest?transactionId=${coffee.id}`);
  t.correctAndSuggest = elapsed(s);
  log(`PATCH ${coffee.description} -> ${patched.categoryName}; suggest "${sug.pattern}" (${sug.matchType}, ${sug.matchCount} matching) in ${t.correctAndSuggest}`);
  s = Date.now();
  const rule = await api('POST', '/rules', { pattern: sug.pattern, matchType: sug.matchType, categoryId: cats.Restaurants.id, applyToExisting: true });
  t.createRule = elapsed(s);
  log(`rule ${rule.id} created, appliedCount ${rule.appliedCount} in ${t.createRule}`);
  const stillFood = (await api('GET', `/transactions?search=${encodeURIComponent('BLUE BOTTLE')}`)).filter((x) => x.categoryName !== 'Restaurants');
  log(`Blue Bottle rows not Restaurants after rule: ${stillFood.length}`);

  // ---- step 3: live ingest
  const file = L.path.join(L.UPLOAD_DIR, `Summit_Rewards_Visa_${L.LIVE_MONTH}.pdf`);
  const form = new FormData();
  form.append('files', new Blob([L.fs.readFileSync(file)], { type: 'application/pdf' }), L.path.basename(file));
  s = Date.now();
  await api('POST', '/statements/upload', form);
  t.upload = elapsed(s);
  const job = await L.processMonth(L.LIVE_MONTH, 'incremental', { retries: 0 });
  t.process = `${job.seconds.toFixed(1)}s`;
  t.uploadPlusProcess = elapsed(s);
  log(`job ${job.id}: ${job.message} | inserted ${job.inserted}, rules ${job.rulesApplied}, transfers ${job.transfersMatched}, ` +
    `gemma ${job.categorized}, errors ${JSON.stringify(job.errors)} — upload ${t.upload}, upload+process ${t.uploadPlusProcess}`);
  const st = (await api('GET', `/statements?month=${L.LIVE_MONTH}`)).find((f) => /Summit/.test(f.fileName));
  log(`statement ${st.fileName}: ${st.lastParseMethod}, ${st.transactionCount} rows, reconciliation ${st.reconciliationStatus} ` +
    `(opening ${st.openingBalance}, closing ${st.closingBalance}, diff ${st.reconciliationDiff})`);
  const feb = await api('GET', `/transactions?month=${L.LIVE_MONTH}`);
  const pay = feb.find((x) => /PAYMENT THANK YOU/.test(x.description));
  log(`card payment ${pay && pay.amount} ${pay && pay.categoryName}/${pay && pay.categorizedBy} paired with ${pay && pay.transferPairAccountName} (#${pay && pay.transferPairId})`);
  for (const x of feb.filter((r) => r.accountName === 'Summit Rewards Visa')) {
    console.log(`    ${x.date} ${x.description.padEnd(44)} ${String(x.amount).padStart(9)} ${x.categoryName} (${x.categorizedBy}${x.needsReview ? ', review' : ''})`);
  }

  // ---- step 4: budget from a month
  s = Date.now();
  const body = { fromMonth: '2025-01', source: 'average', averageMonths: 3, roundTo: 25, effectiveFrom: L.LIVE_MONTH };
  const preview = await api('POST', '/budget/main/seed/preview', body);
  const seeded = await api('POST', '/budget/main/seed', body);
  t.seed = elapsed(s);
  log(`seed preview total ${preview.total} (${preview.items.map((i) => `${i.categoryName} ${i.currentMainAmount}->${i.amount}`).join(', ')}); main as of ${seeded.month} total ${seeded.total} in ${t.seed}`);

  console.log('\nTimings:', t);
}

main().catch((err) => { console.error(err); process.exit(1); });
