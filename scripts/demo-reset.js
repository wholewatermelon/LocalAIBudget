#!/usr/bin/env node
/*
 * Puts the app back into the staged demo state in a few seconds (works while `npm run dev` is running, fully offline):
 *   1. regenerate the --demo statements (deterministic → identical to what the snapshot was built from; removes uploads)
 *   2. restore demo/snapshot.sql (drop + recreate the public schema, psql in one transaction)
 *   3. warm up Gemma (model stays loaded for OLLAMA_KEEP_ALIVE, default 60m)
 *   4. check /api/health and print a ready checklist
 *
 *   npm run demo:reset            # all of the above
 *   node scripts/demo-reset.js --no-warm
 */
'use strict';

const L = require('./demo-lib');
const { log, api, elapsed } = L;

async function main() {
  const t = {};
  const s0 = Date.now();
  if (!L.fs.existsSync(L.SNAPSHOT)) throw new Error('demo/snapshot.sql missing — run `npm run demo:prepare` first');

  const h0 = await L.health();
  if (!h0.error) {
    // a job still running would keep writing into the restored DB; wait for it (the in-memory runner holds nothing else)
    for (let i = 0; i < 60; i++) {
      const active = await L.activeJobs();
      if (!active.length) break;
      if (i === 0) log(`waiting for running job(s): ${active.map((j) => `${j.id} (${j.month})`).join(', ')}`);
      await L.sleep(2000);
      if (i === 59) throw new Error('A processing job is still running; stop it or wait, then retry.');
    }
  } else {
    log('API not reachable — restoring anyway (start it with `npm run dev`)');
  }

  let s = Date.now();
  const files = L.generateDemoStatements();
  t.statements = elapsed(s);
  // belt and braces: the live month folder must hold only the pre-loaded checking statement (uploads removed)
  const liveDir = L.path.join(L.STATEMENTS_DIR, L.LIVE_MONTH);
  for (const f of L.fs.readdirSync(liveDir)) {
    if (/^Maple_Federal_Checking_/.test(f)) continue;
    L.fs.rmSync(L.path.join(liveDir, f), { force: true, maxRetries: 20, retryDelay: 100 });
    log(`removed leftover ${L.LIVE_MONTH}/${f}`);
  }
  const left = L.fs.readdirSync(liveDir);
  if (left.length !== 1) throw new Error(`${liveDir} still contains: ${left.join(', ')}`);
  log(`statements regenerated (${files} files) in ${t.statements}`);

  s = Date.now();
  L.pgTool('psql', ['-d', L.DB.database, '-q', '-1', '-v', 'ON_ERROR_STOP=1',
    '-c', 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;', '-f', L.SNAPSHOT]);
  t.restore = elapsed(s);
  log(`database restored from demo/snapshot.sql in ${t.restore}`);

  // the snapshot may predate newer migrations; bring the restored schema up to date (no-op when current)
  s = Date.now();
  require('child_process').execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--prefix', L.path.join(L.ROOT, 'server'), 'run', '-s', 'migrate'],
    { stdio: 'pipe', shell: process.platform === 'win32' });
  log(`migrations checked in ${elapsed(s)}`);
  t.totalExclWarmup = elapsed(s0);

  if (!process.argv.includes('--no-warm')) {
    s = Date.now();
    try {
      await L.warmGemma();
      t.warmup = elapsed(s);
      log(`Gemma warm (${L.MODEL}) in ${t.warmup}`);
    } catch (err) {
      log(`WARNING Gemma warm-up failed: ${err.message}`);
    }
  }

  // ---- checklist
  const ok = (cond, label) => console.log(`  ${cond ? '[x]' : '[ ] !!'} ${label}`);
  const h = await L.health();
  console.log('\nReady checklist');
  ok(h.db === 'ok', `API + DB up (${L.API})`);
  ok(h.ollama === 'ok' && h.modelAvailable, `Ollama up, model ${h.model} available (health dot green)`);
  if (!h.error) {
    const months = await api('GET', '/months');
    const m = (k) => months.find((x) => x.month === k) || {};
    ok(months.some((x) => x.month === '2024-08') && m('2025-01').transactionCount > 0, `history 2024-08..2025-01 (${months.length} months)`);
    ok(m('2025-01').needsReviewCount >= 3 && m('2025-01').needsReviewCount <= 5, `2025-01 needs review: ${m('2025-01').needsReviewCount}`);
    ok(m('2024-10').reconciliationIssues === 1, `2024-10 reconciliation issue: ${m('2024-10').reconciliationIssues}`);
    const feb = await api('GET', `/statements?month=${L.LIVE_MONTH}`);
    ok(feb.length === 1 && /Checking/.test(feb[0].fileName), `${L.LIVE_MONTH}: only ${feb.map((f) => f.fileName).join(', ')}`);
    const rules = await api('GET', '/rules');
    ok(!rules.some((r) => /BLUE BOTTLE/i.test(r.pattern)), `no coffee rule yet (${rules.length} rules)`);
    const coffee = (await api('GET', '/transactions?month=2025-01&needsReview=true')).find((x) => /BLUE BOTTLE/.test(x.description));
    if (coffee) {
      const sug = await api('GET', `/rules/suggest?transactionId=${coffee.id}`);
      ok(coffee.categoryName === 'Food', `review row: ${coffee.date} "${coffee.description}" ${coffee.amount} = ${coffee.categoryName}`);
      ok(sug.matchCount >= 10, `suggestion: "${sug.pattern}" (${sug.matchCount} matching)`);
    } else ok(false, 'Blue Bottle row in the 2025-01 review queue');
    const ins = await api('GET', '/insights?month=2025-01');
    ok(ins && ins.suggestions.length > 0, `insight for 2025-01 (${ins ? ins.suggestions.length : 0} suggestions)`);
    ok(L.fs.existsSync(L.path.join(L.UPLOAD_DIR, `Summit_Rewards_Visa_${L.LIVE_MONTH}.pdf`)), `upload file demo/upload/Summit_Rewards_Visa_${L.LIVE_MONTH}.pdf`);
  }
  console.log(`\nReset ${t.totalExclWarmup} (excl. warm-up)${t.warmup ? `, warm-up ${t.warmup}` : ''}. ` +
    'Reload the browser tab (http://localhost:4200/?month=2025-01).');
}

main().catch((err) => { console.error(err); process.exit(1); });
