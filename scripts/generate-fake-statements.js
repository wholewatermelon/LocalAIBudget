#!/usr/bin/env node
/*
 * Synthetic-but-realistic statement generator for LocalAI Budget.
 *
 * One fictional household, three consecutive months (2024-11, 2024-12, 2025-01 — crosses a year on purpose),
 * one deterministic ledger (seeded PRNG, never Math.random) rendered into the layouts real banks use:
 *
 *   Maple Federal Checking  bank   PDF every month (running-balance layout, wrapped rows, daily balance section)
 *                                  + CSV (2025-01, Debit/Credit/Balance, preamble, newest first)
 *                                  + OFX 2.x XML (2025-01, same basename as the CSV -> exercises OFX > CSV > PDF)
 *   Maple Federal Savings   bank   old-style TXT (2024-12 only)  `YYYY-MM-DD desc amount`
 *   Summit Rewards Visa     card   PDF every month (cycle 5th..4th; Trans/Post dates; sections; APR table)
 *   Harbor Cash Back Card   card   QFX / OFX 1.x SGML (2024-11), CSV (2024-12, 2025-01; BOM, CRLF, quoted commas)
 *
 * Usage (from repo root):
 *   node scripts/generate-fake-statements.js                 -> data/statements/YYYY-MM/...
 *   node scripts/generate-fake-statements.js --out <dir>     -> <dir>/YYYY-MM/...
 *   node scripts/generate-fake-statements.js --fixtures      -> fixtures/statements/ (flat, small, + .expected.json)
 *   node scripts/generate-fake-statements.js --fixtures --out <dir>
 *   node scripts/generate-fake-statements.js --from 2024-08 --to 2025-02   -> any month range (same rules per month)
 *   node scripts/generate-fake-statements.js --demo [--upload-dir demo/upload]
 *       -> demo set: wipes <out>/YYYY-MM folders, writes 2024-08..2025-01 all accounts (savings TXT every month,
 *          Summit paid in full monthly), 2024-10 checking with a $42.17 reconciliation mismatch, 2025-02 checking only,
 *          and the small live-upload Summit_Rewards_Visa_2025-02.pdf in --upload-dir. Used by scripts/demo-*.js.
 *
 * --fixtures always uses the fixed 2024-11..2025-01 ledger; fixtures/statements/ must stay byte-identical.
 *
 * All institutions, people, addresses, account numbers and routing numbers are fictional.
 */
'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------------------------------------------ CLI

function parseArgs(argv) {
  const opts = { out: null, fixtures: false, demo: false, from: null, to: null, uploadDir: path.join('demo', 'upload') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fixtures') opts.fixtures = true;
    else if (a === '--out') opts.out = argv[++i];
    else if (a.startsWith('--out=')) opts.out = a.slice(6);
    else if (a === '--demo') opts.demo = true;
    else if (a === '--from') opts.from = argv[++i];
    else if (a === '--to') opts.to = argv[++i];
    else if (a === '--upload-dir') opts.uploadDir = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log('Usage: node scripts/generate-fake-statements.js [--out <dir>] [--from YYYY-MM --to YYYY-MM] [--fixtures | --demo [--upload-dir <dir>]]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${a}`);
  }
  const ymRe = /^\d{4}-(0[1-9]|1[0-2])$/;
  for (const k of ['from', 'to']) if (opts[k] && !ymRe.test(opts[k])) throw new Error(`--${k} must be YYYY-MM`);
  if (opts.fixtures && (opts.from || opts.to || opts.demo)) throw new Error('--fixtures uses a fixed month range; it cannot be combined with --from/--to/--demo');
  if (!opts.out) opts.out = opts.fixtures ? path.join('fixtures', 'statements') : path.join('data', 'statements');
  return opts;
}

// ------------------------------------------------------------------------------------------------ PRNG

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  constructor(seed) { this.next = mulberry32(seed); }
  float() { return this.next(); }
  int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
  amount(min, max) { return round2(min + this.next() * (max - min)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  code(n, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789') {
    let s = '';
    for (let i = 0; i < n; i++) s += alphabet[Math.floor(this.next() * alphabet.length)];
    return s;
  }
  digits(n) { return this.code(n, '0123456789'); }
}

// ------------------------------------------------------------------------------------------------ helpers

const round2 = (n) => Math.round(n * 100) / 100;
const sum = (rows, f = (r) => r.amount) => round2(rows.reduce((a, r) => a + f(r), 0));
const fmt = (n) => Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSigned = (n) => (n < 0 ? '-' : '') + fmt(n);
const money = (n) => (n < 0 ? '-$' : '$') + fmt(n);
const plain = (n) => n.toFixed(2); // CSV/OFX style: no thousands separator

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

function toDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function toIso(dt) { return dt.toISOString().slice(0, 10); }
function addDays(iso, n) { const d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return toIso(d); }
function dow(iso) { return toDate(iso).getUTCDay(); }
const HOLIDAYS = new Set(['2024-09-02', '2024-10-14', '2024-11-11', '2024-11-28', '2024-12-25', '2025-01-01', '2025-01-20', '2025-02-17']);
function isBusinessDay(iso) { const w = dow(iso); return w !== 0 && w !== 6 && !HOLIDAYS.has(iso); }
function nextBusinessDay(iso) { let d = iso; while (!isBusinessDay(d)) d = addDays(d, 1); return d; }
function lastDayOfMonth(ym) { const [y, m] = ym.split('-').map(Number); return toIso(new Date(Date.UTC(y, m, 0))); }
function lastBusinessDayOfMonth(ym) { let d = lastDayOfMonth(ym); while (!isBusinessDay(d)) d = addDays(d, -1); return d; }
const mmdd = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
const mdy = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const mdyShort = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(2, 4)}`;
const longDate = (iso) => `${MONTH_NAMES[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}, ${iso.slice(0, 4)}`;
const ymd = (iso) => iso.replace(/-/g, '');
function eachDay(start, end, fn) { for (let d = start; d <= end; d = addDays(d, 1)) fn(d); }
const inRange = (iso, a, b) => iso >= a && iso <= b;
const byDate = (key) => (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : a.seq - b.seq);

let SEQ = 0; // global insertion order -> stable sort within a day

// ------------------------------------------------------------------------------------------------ household

const DEFAULT_MONTHS = ['2024-11', '2024-12', '2025-01'];
const DEMO_FROM = '2024-08';
const DEMO_LIVE_MONTH = '2025-02'; // checking pre-loaded; Summit uploaded live from demo/upload/
const DEMO_MISMATCH_MONTH = '2024-10';
let MONTHS = DEFAULT_MONTHS; // ledger months; set by buildLedgers()
function monthRange(from, to) {
  const out = [];
  for (let ym = from; ym <= to; ym = addDays(lastDayOfMonth(ym), 1).slice(0, 7)) out.push(ym);
  if (!out.length) throw new Error(`Empty month range ${from}..${to}`);
  return out;
}
const nextMonth = (ym) => addDays(lastDayOfMonth(ym), 1).slice(0, 7);
const firstDay = () => `${MONTHS[0]}-01`;
const lastDay = () => lastDayOfMonth(MONTHS[MONTHS.length - 1]);
const HOUSEHOLD = {
  names: ['JORDAN M RIVERA', 'CASEY L RIVERA'],
  street: '418 LARKSPUR LN',
  city: 'FAIRVIEW OR 97024-5512',
};
const ACCT = {
  checking: { name: 'Maple Federal Checking', type: 'Bank', number: '000048112290', masked: 'XXXXXX2290' },
  savings: { name: 'Maple Federal Savings', type: 'Bank', number: '000048114471', masked: 'XXXXXX4471' },
  summit: { name: 'Summit Rewards Visa', type: 'Credit Card', masked: 'XXXX XXXX XXXX 4417', last4: '4417' },
  harbor: { name: 'Harbor Cash Back Card', type: 'Credit Card', masked: 'XXXXXXXXXXXX8812', last4: '8812' },
};
const baseName = (acct, ym) => `${acct.name.replace(/ /g, '_')}_${ym}`;

const CHECKING_OPENING = 4812.37; // balance on the first morning of the range
const CHECKING_OPENING_DEMO = 8312.37; // demo household runs a 7-month slight deficit; keep checking positive
const SAVINGS_OPENING_DEC = 12640.55;
const SUMMIT_PREV_BALANCE = 3214.56; // owed, carried into the 11/05 cycle
const HARBOR_OPENING_OWED = 1284.17; // October spend, auto-paid in November
const SUMMIT_APR = 22.99;
// Summit cycle for month M runs M-05 .. (M+1)-04
const summitCycles = () => MONTHS.map((ym) => ({ ym, start: `${ym}-05`, end: `${nextMonth(ym)}-04` }));
const SUMMIT_PAYMENTS = {
  '2024-08': 1400.0, '2024-09': 1650.0, '2024-10': 1300.0,
  '2024-11': 1500.0, '2024-12': 1850.0, '2025-01': 2275.0, '2025-02': 1900.0,
};
let DEMO = false; // demo ledger: Summit paid in full monthly, extra income, savings statements every month

// ------------------------------------------------------------------------------------------------ ledgers

function buildLedgers(months = DEFAULT_MONTHS, { demo = false } = {}) {
  SEQ = 0;
  MONTHS = months;
  DEMO = demo;
  const allSavings = demo;
  const summit = buildSummit(new Rng(0x5a11));
  const harbor = buildHarbor(new Rng(0x4a7b));
  const savings = buildSavings(allSavings);
  const checking = buildChecking(new Rng(0xc4ec), summit, harbor, savings);
  if (demo) closeSummitCyclesPaidInFull(summit, MONTHS.length); else finishSummitCycles(summit);
  return { checking, savings, summit, harbor };
}

/* ---- Summit Rewards Visa (normalized amounts: purchase negative, payment/credit positive) ---- */
function buildSummit(rng) {
  const rows = [];
  const add = (transDate, desc, amount, section, kind, postLag) => {
    const postDate = addDays(transDate, postLag == null ? rng.int(0, 2) : postLag);
    rows.push({ transDate, postDate, desc, amount: round2(amount), section, kind, seq: SEQ++ });
  };
  const amzn = () => `AMZN Mktp US*${rng.code(6)} Amzn.com/bill WA`;
  const pools = [
    { w: 4, kind: 'grocery', f: () => [rng.pick(['COSTCO WHSE #0681 WOOD VILLAGE OR', 'NEW SEASONS MARKET FAIRVIEW OR', 'SAFEWAY #1544 FAIRVIEW OR']), rng.amount(38, 265)] },
    { w: 3, kind: 'restaurant', f: () => [rng.pick(['TST* LUIGIS TRATTORIA FAIRVIEW OR', 'TST* PINE STATE BISCUITS PORTLAND OR', 'SQ *TACO PEDRO GRESHAM OR', 'OLIVE GARDEN 0012345 GRESHAM OR', 'PIZZICATO #14 PORTLAND OR']), rng.amount(18, 96)] },
    { w: 4, kind: 'coffee', f: () => [rng.pick(['SQ *BLUE BOTTLE COFFEE OAKLAND CA', 'STARBUCKS STORE 05521 GRESHAM OR', 'SQ *CASCADE ROASTERS FAIRVIEW OR']), rng.amount(4.25, 14.8)] },
    { w: 3, kind: 'amazon', f: () => [amzn(), rng.amount(9.99, 129.99)] },
    { w: 1, kind: 'gas', f: () => [rng.pick(['SHELL OIL 57442110021 FAIRVIEW OR', 'COSTCO GAS #0681 WOOD VILLAGE OR']), rng.amount(38, 72)] },
    { w: 1, kind: 'shopping', f: () => [rng.pick(['TARGET 00012345 GRESHAM OR', 'KOHL\'S #1129 GRESHAM OR', 'REI #57 PORTLAND OR', 'POWELL\'S BOOKS PORTLAND OR']), rng.amount(14, 160)] },
  ];
  const totalW = pools.reduce((a, p) => a + p.w, 0);
  const pickPool = () => { let r = rng.float() * totalW; for (const p of pools) { if ((r -= p.w) < 0) return p; } return pools[0]; };

  eachDay(firstDay(), `${nextMonth(MONTHS[MONTHS.length - 1])}-04`, (d) => {
    const day = +d.slice(8, 10);
    if (day === 3) add(d, 'SQ *LITTLE STARS DANCE ACADEMY FAIRVIEW OR', -95.0, 'purchase', 'kids');
    if (day === 9) add(d, 'SPOTIFY USA 877-778-1161 NY', -16.99, 'purchase', 'streaming', 0);
    if (day === 15) add(d, 'NETFLIX.COM 866-579-7172 CA', -22.99, 'purchase', 'streaming', 0);
    if (day === 21) add(d, 'DISNEY PLUS 888-905-7888 CA', -13.99, 'purchase', 'streaming', 1);
    const n = rng.float() < 0.12 ? 0 : rng.float() < 0.5 ? 1 : rng.float() < 0.7 ? 2 : 3;
    for (let i = 0; i < n; i++) { const p = pickPool(); const [desc, amt] = p.f(); add(d, desc, -amt, 'purchase', p.kind); }
  });
  // one-offs
  add('2024-11-27', 'FAIRVIEW PARKS & REC ONLINE REGISTRATION 503-555-0199 OR', -145.0, 'purchase', 'kids');
  add('2024-12-07', 'BEST BUY 00004512 GRESHAM OR', -349.99, 'purchase', 'shopping');
  add('2024-12-14', 'ETSY.COM - CRAFTEDBYJUNE BROOKLYN NY', -48.5, 'purchase', 'shopping');
  add('2024-12-16', 'ALASKA AIR 0277142903318 SEATTLE WA PASSENGER: RIVERA/JORDAN M', -412.6, 'purchase', 'travel', 1);
  add('2024-12-28', 'WHISTLER BLACKCOMB GUEST SVCS WHISTLER BC', -186.4, 'purchase', 'foreign', 2);
  add('2024-12-28', 'FOREIGN TRANSACTION FEE', -5.59, 'fee', 'fee', 2);
  add('2024-12-30', 'AMZN Mktp US*RT4QL2 RETURN Amzn.com/bill WA', 34.99, 'credit', 'refund', 2);
  add('2025-01-11', 'YMCA OF COLUMBIA-WILLAMETTE 503-555-0177 OR', -68.0, 'purchase', 'kids');
  return { rows, cycles: [] };
}

function addSummitPayment(summit, checkingDate, amount) {
  const d = nextBusinessDay(addDays(checkingDate, 1)); // posts 1-3 days after it leaves checking
  summit.rows.push({ transDate: d, postDate: d, desc: 'PAYMENT THANK YOU - WEB', amount, section: 'credit', kind: 'payment', seq: SEQ++ });
}

/**
 * Demo variant: the household pays each statement balance in full, so no interest accrues. Cycles are closed
 * incrementally because the payment in cycle M (made on the 20th) equals the closing balance of cycle M-1.
 */
function closeSummitCyclesPaidInFull(summit, upTo) {
  const cycles = summitCycles();
  while (summit.cycles.length < upTo) {
    const c = cycles[summit.cycles.length];
    const prev = summit.cycles.length ? summit.cycles[summit.cycles.length - 1].closing : SUMMIT_PREV_BALANCE;
    const all = summit.rows.filter((r) => inRange(r.postDate, c.start, c.end));
    summit.cycles.push({ ...c, opening: prev, closing: round2(prev - sum(all)) });
  }
}
function demoSummitPayment(summit, ym) {
  const i = MONTHS.indexOf(ym);
  closeSummitCyclesPaidInFull(summit, i);
  return i === 0 ? SUMMIT_PREV_BALANCE : summit.cycles[i - 1].closing;
}

function finishSummitCycles(summit) {
  let prev = SUMMIT_PREV_BALANCE;
  for (const c of summitCycles()) {
    const inCycle = summit.rows.filter((r) => inRange(r.postDate, c.start, c.end));
    const pay = sum(inCycle.filter((r) => r.kind === 'payment'));
    const purchases = -sum(inCycle.filter((r) => r.section === 'purchase'));
    const days = (toDate(c.end) - toDate(c.start)) / 86400000 + 1;
    const avgDaily = round2(prev - pay * 0.5 + purchases * 0.5);
    const interest = round2((avgDaily * SUMMIT_APR) / 100 / 365 * days);
    summit.rows.push({ transDate: c.end, postDate: c.end, desc: 'PURCHASE INTEREST CHARGE', amount: -interest, section: 'interest', kind: 'interest', seq: SEQ++, avgDaily });
    const all = summit.rows.filter((r) => inRange(r.postDate, c.start, c.end));
    const closing = round2(prev - sum(all));
    summit.cycles.push({ ...c, opening: prev, closing });
    prev = closing;
  }
}

/* ---- Harbor Cash Back Card (normalized: purchase negative) ---- */
function buildHarbor(rng) {
  const rows = [];
  const add = (transDate, desc, category, type, amount, kind) => {
    rows.push({ transDate, postDate: addDays(transDate, rng.int(0, 2)), desc, category, type, amount: round2(amount), kind, seq: SEQ++ });
  };
  const pools = [
    { w: 3, kind: 'grocery', cat: 'Groceries', f: () => [rng.pick(['TRADER JOE S #145 PORTLAND OR', 'WINCO FOODS #112 GRESHAM OR', 'FRED-MEYER #0651 GRESHAM OR']), rng.amount(22, 190)] },
    { w: 3, kind: 'delivery', cat: 'Food & Drink', f: () => [rng.pick(['DOORDASH*THAI BASIL, FAIRVIEW OR', 'DOORDASH*BURGERVILLE #12', 'UBER *EATS PENDING HELP.UBER.COM CA', 'PANDA EXPRESS #1912 GRESHAM OR']), rng.amount(14, 68)] },
    { w: 2, kind: 'gas', cat: 'Gas', f: () => [rng.pick(['CHEVRON 0098812 FAIRVIEW OR', 'ARCO #82211 AMPM GRESHAM OR', 'FRED-MEYER FUEL #0651 GRESHAM OR']), rng.amount(30, 70)] },
    { w: 2, kind: 'shopping', cat: 'Shopping', f: () => [rng.pick(['PAYPAL *ETSY, INC 4029357733 CA', 'SQ *SMITH & SONS, LLC PORTLAND OR', 'THE HOME DEPOT #4012 GRESHAM OR', 'CHEWY.COM 800-672-4399 FL']), rng.amount(12, 140)] },
    { w: 1, kind: 'rideshare', cat: 'Travel', f: () => [`LYFT *RIDE ${rng.pick(['FRI', 'SAT', 'SUN'])} ${rng.int(5, 11)}PM, SAN FRANCISCO CA`, rng.amount(9, 38)] },
    { w: 1, kind: 'pharmacy', cat: 'Health & Wellness', f: () => [rng.pick(['WALGREENS #06124 FAIRVIEW OR', 'CVS/PHARMACY #10422 GRESHAM OR']), rng.amount(6, 55)] },
  ];
  const totalW = pools.reduce((a, p) => a + p.w, 0);
  const pickPool = () => { let r = rng.float() * totalW; for (const p of pools) { if ((r -= p.w) < 0) return p; } return pools[0]; };
  eachDay(firstDay(), lastDay(), (d) => {
    const day = +d.slice(8, 10);
    if (day === 2) add(d, 'APPLE.COM/BILL 866-712-7753 CA', 'Entertainment', 'Sale', -9.99, 'streaming');
    if (day === 18) add(d, 'HULU 877-8244858 CA', 'Entertainment', 'Sale', -18.99, 'streaming');
    const n = rng.float() < 0.15 ? 0 : rng.float() < 0.5 ? 1 : rng.float() < 0.7 ? 2 : 3;
    for (let i = 0; i < n; i++) { const p = pickPool(); const [desc, amt] = p.f(); add(d, desc, p.cat, 'Sale', -amt, p.kind); }
  });
  add('2024-11-09', 'SQ *SMITH & SONS, LLC PORTLAND OR', 'Shopping', 'Sale', -64.0, 'shopping');
  add('2024-12-09', 'THE HOME DEPOT #4012 GRESHAM OR', 'Shopping', 'Return', 42.18, 'refund');
  add('2025-01-14', 'PAYPAL *ETSY, INC 4029357733 CA', 'Shopping', 'Return', 23.5, 'refund');
  rows.sort(byDate('transDate'));

  // autopay: previous calendar month's balance, paid on the 23rd (next business day); checking is debited 1 day later
  const months = [];
  let opening = HARBOR_OPENING_OWED;
  for (const ym of MONTHS) {
    const payDate = nextBusinessDay(`${ym}-23`);
    const payment = opening;
    rows.push({ transDate: payDate, postDate: payDate, desc: 'AUTOMATIC PAYMENT - THANK YOU', category: '', type: 'Payment', amount: payment, kind: 'payment', seq: SEQ++ });
    const inMonth = rows.filter((r) => r.transDate.startsWith(ym));
    const closing = round2(opening - sum(inMonth));
    months.push({ ym, opening, closing, payDate, payment });
    opening = closing;
  }
  rows.sort(byDate('transDate'));
  return { rows, months };
}

/* ---- Maple Federal Savings (default: only December is published, as TXT; allSavings: every month) ---- */
function buildSavings(allSavings) {
  if (allSavings) {
    const rows = [];
    for (const ym of MONTHS) {
      const xfer = nextBusinessDay(`${ym}-05`); // checking side
      rows.push({ date: nextBusinessDay(addDays(xfer, 1)), desc: 'ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290', amount: 500.0, kind: 'xfer-in', seq: SEQ++ });
      if (ym === '2024-12') rows.push({ date: '2024-12-18', desc: 'ONLINE TRANSFER TO MAPLE FEDERAL CHECKING XXXXXX2290 HOLIDAY', amount: -300.0, kind: 'xfer-out', seq: SEQ++ });
      rows.push({ date: lastDayOfMonth(ym), desc: 'INTEREST PAYMENT', amount: round2(5.2 + MONTHS.indexOf(ym) * 0.23), kind: 'interest', seq: SEQ++ });
    }
    return { rows, opening: null, closing: null };
  }
  const rows = [
    { date: '2024-12-06', desc: 'ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290', amount: 500.0, kind: 'xfer-in', seq: SEQ++ },
    { date: '2024-12-18', desc: 'ONLINE TRANSFER TO MAPLE FEDERAL CHECKING XXXXXX2290 HOLIDAY', amount: -300.0, kind: 'xfer-out', seq: SEQ++ },
    { date: '2024-12-31', desc: 'INTEREST PAYMENT', amount: 6.12, kind: 'interest', seq: SEQ++ },
  ];
  return { rows, opening: SAVINGS_OPENING_DEC, closing: round2(SAVINGS_OPENING_DEC + sum(rows)) };
}

/* ---- Maple Federal Checking (normalized: debit negative). `date` = posting date. ---- */
function buildChecking(rng, summit, harbor, savings) {
  const rows = [];
  const add = (date, desc, amount, kind) => rows.push({ date, desc, amount: round2(amount), kind, seq: SEQ++ });
  const debitPools = [
    { w: 4, kind: 'grocery', f: () => [rng.pick(['SAFEWAY #1544 FAIRVIEW OR', 'WINCO FOODS #112 GRESHAM OR', 'FRED-MEYER #0651 GRESHAM OR', 'GROCERY OUTLET #388 GRESHAM OR']), rng.amount(18, 175)] },
    { w: 3, kind: 'gas', f: () => [rng.pick(['SHELL OIL 57442', 'CHEVRON 0098812 FAIRVIEW OR', 'ARCO #82211 AMPM']), rng.amount(32, 68)] },
    { w: 4, kind: 'coffee', f: () => [rng.pick(['DUTCH BROS #OR0212 FAIRVIEW OR', 'SQ *CASCADE ROASTERS FAIRVIEW OR']), rng.amount(4.5, 12.75)] },
    { w: 2, kind: 'restaurant', f: () => [rng.pick(['CHIPOTLE 2291 GRESHAM OR', 'MCDONALD\'S F21877 FAIRVIEW OR', 'TST* LUIGIS TRATTORIA FAIRVIEW OR', 'SUBWAY 00412290 GRESHAM OR']), rng.amount(8, 64)] },
    { w: 1, kind: 'pharmacy', f: () => [rng.pick(['WALGREENS #06124 FAIRVIEW OR', 'RITE AID STORE 5411 GRESHAM OR']), rng.amount(5, 48)] },
    { w: 1, kind: 'shopping', f: () => [rng.pick(['TARGET T-1544 GRESHAM OR', 'DOLLAR TREE #6612 FAIRVIEW OR', 'GOODWILL #22 GRESHAM OR']), rng.amount(6, 85)] },
  ];
  const totalW = debitPools.reduce((a, p) => a + p.w, 0);
  const pickPool = () => { let r = rng.float() * totalW; for (const p of debitPools) { if ((r -= p.w) < 0) return p; } return debitPools[0]; };
  let checkNo = 1041;

  // payroll: biweekly Fridays + semimonthly (15th & last business day)
  let payday = '2024-11-01'; // biweekly anchor (a Friday)
  while (addDays(payday, -14) >= firstDay()) payday = addDays(payday, -14);
  for (let d = payday; d <= lastDay(); d = addDays(d, 14)) add(d, 'ACH DEPOSIT BRIGHTLINE LOGISTICS PAYROLL PPD ID: 9100234517', 2846.15, 'payroll');
  for (const ym of MONTHS) {
    add(nextBusinessDay(`${ym}-15`), 'ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784', 1912.4, 'payroll');
    add(lastBusinessDayOfMonth(ym), 'ACH DEPOSIT CEDARVALE SCHOOL DIST DIR DEP PPD ID: 5520017784', 1912.4, 'payroll');
    add(nextBusinessDay(`${ym}-01`), 'ACH DEBIT PINECREST HOME LOANS MTG PYMT PPD ID: 4417730021', -2385.0, 'mortgage');
    add(nextBusinessDay(`${ym}-03`), 'ACH DEBIT EVERGREEN MUTUAL INS PREM PPD ID: 6610023385', -188.42, 'insurance');
    add(nextBusinessDay(`${ym}-08`), 'ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT WEB ID: 9300012231', -rng.amount(118, 214), 'utility');
    add(nextBusinessDay(`${ym}-12`), 'ACH DEBIT FAIRVIEW CITY UTILITIES WATER/SEWER WEB ID: 3300298811', -rng.amount(61, 96), 'utility');
    add(nextBusinessDay(`${ym}-17`), 'RIVERNET BROADBAND AUTOPAY 800-555-0142', -79.99, 'utility');
    add(nextBusinessDay(`${ym}-22`), 'ACH DEBIT VELOCITY WIRELESS AUTOPAY PPD ID: 2280041190', -142.67, 'utility');
    // checking -> savings on the 5th; the savings side (TXT) exists only for December and lands 1 day later
    add(nextBusinessDay(`${ym}-05`), `ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS ${ACCT.savings.masked} REF #IB${rng.code(7)}`, -500.0, 'xfer-savings');
    // kids' piano lessons by check
    add(nextBusinessDay(`${ym}-0${rng.int(6, 9)}`), `CHECK #${checkNo++}`, -160.0, 'check');
    // Summit payment from checking on the 20th (bd); card side posts 1-3 days later with the same amount
    const sDate = nextBusinessDay(`${ym}-20`);
    const sAmount = DEMO ? demoSummitPayment(summit, ym) : SUMMIT_PAYMENTS[ym];
    add(sDate, `ONLINE PMT SUMMIT VISA ACCT ENDING ${ACCT.summit.last4} CONF# ${rng.code(8)}`, -sAmount, 'card-payment');
    addSummitPayment(summit, sDate, sAmount);
    if (DEMO) add(nextBusinessDay(`${ym}-10`), 'ACH DEPOSIT HARBORVIEW CONSULTING INVOICE PPD ID: 8830021147', 1350.0, 'payroll');
    // Harbor autopay: card shows it on payDate, checking debited next business day
    const h = harbor.months.find((m) => m.ym === ym);
    add(nextBusinessDay(addDays(h.payDate, 1)), 'HARBOR CARD AUTOPAY PPD ID: 7781000231', -h.payment, 'card-payment');
    // month-end interest
    add(lastDayOfMonth(ym), 'INTEREST PAYMENT', rng.amount(0.21, 0.58), 'interest');
  }
  // savings -> checking (December, counterpart in savings TXT on the same day)
  const svOut = savings.rows.find((r) => r.kind === 'xfer-out');
  add(svOut.date, `ONLINE TRANSFER FROM MAPLE FEDERAL SAVINGS ${ACCT.savings.masked} REF #IB${rng.code(7)}`, -svOut.amount, 'xfer-from-savings');
  // checking -> an outside savings account we have no statement for: must stay UNPAIRED
  add('2024-12-27', 'ONLINE TRANSFER TO TIDEWATER ONLINE SAVINGS XXXXX7730 WEB ID: 1774400920', -250.0, 'xfer-unpaired');
  // misc one-offs
  add('2024-11-12', 'VENMO CASHOUT PPD ID: 5264681992', 45.0, 'venmo');
  add('2025-01-08', 'VENMO CASHOUT PPD ID: 5264681992', 72.5, 'venmo');
  add('2024-12-04', 'POS RETURN 12/03 TARGET T-1544 GRESHAM OR', 36.18, 'refund');
  add('2024-12-16', 'NON-MAPLE FEDERAL ATM FEE', -3.0, 'fee');
  add('2025-01-29', 'MOBILE DEPOSIT REF NUMBER :418820557731', 125.0, 'mobile-deposit');

  // ATM withdrawals and card purchases (description carries the purchase date; posts 0-1 business days later)
  eachDay(firstDay(), lastDay(), (d) => {
    if ([2, 16].includes(+d.slice(8, 10)) || d === '2024-12-14') {
      const atm = d === '2024-12-14' ? 'ATM WITHDRAWAL 12/14 FIRSTLINE CU ATM 800 NE 181ST AVE GRESHAM OR' : `ATM WITHDRAWAL ${mmdd(d)} MAPLE FEDERAL ATM #2210 2210 MAIN ST FAIRVIEW OR`;
      add(nextBusinessDay(d), atm, -rng.pick([60, 100, 200]), 'atm');
    }
    const n = rng.float() < 0.25 ? 0 : rng.float() < 0.7 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const p = pickPool();
      const [m, amt] = p.f();
      const prefix = p.kind === 'gas' || rng.chance(0.3) ? 'POS DEBIT' : 'DEBIT CARD PURCHASE';
      const post = rng.chance(0.4) ? d : nextBusinessDay(addDays(d, 1));
      if (post > lastDay()) continue;
      add(post, `${prefix} ${mmdd(d)} ${m}`, -amt, p.kind);
    }
  });
  rows.sort(byDate('date'));

  // running balance + per-month statements
  let bal = DEMO ? CHECKING_OPENING_DEMO : CHECKING_OPENING;
  for (const r of rows) { bal = round2(bal + r.amount); r.balance = bal; }
  const months = MONTHS.map((ym) => {
    const mr = rows.filter((r) => r.date.startsWith(ym));
    const opening = round2(mr[0].balance - mr[0].amount);
    return { ym, opening, closing: mr[mr.length - 1].balance };
  });
  return { rows, months };
}

// ------------------------------------------------------------------------------------------------ PDF helpers

function newPdf() {
  return new PDFDocument({ size: 'LETTER', margins: { top: 36, left: 36, right: 36, bottom: 0 }, bufferPages: true, info: { Producer: 'statement-generator', Creator: 'statement-generator', CreationDate: new Date(Date.UTC(2025, 1, 5, 12)) } });
}
function writePdf(doc, file) {
  return new Promise((resolve, reject) => {
    const s = fs.createWriteStream(file);
    s.on('finish', resolve);
    s.on('error', reject);
    doc.pipe(s);
    doc.end();
  });
}
/** Single-line text at an absolute position. align 'right' => x is the RIGHT edge. Never wraps. */
function put(doc, str, x, y, { font = 'Helvetica', size = 8, align = 'left', color = '#000' } = {}) {
  doc.font(font).fontSize(size).fillColor(color);
  const w = doc.widthOfString(str);
  const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  doc.text(str, left, y, { lineBreak: false });
}
/** Word-wrap to a pixel width; split only on single spaces so " ".join(lines) restores the original text. */
function wrap(doc, str, width, font = 'Helvetica', size = 8) {
  doc.font(font).fontSize(size);
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (cur && doc.widthOfString(cand) > width) { lines.push(cur); cur = w; } else cur = cand;
  }
  if (cur) lines.push(cur);
  return lines;
}
function addFooters(doc, leftText) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.moveTo(36, 748).lineTo(576, 748).lineWidth(0.5).strokeColor('#999').stroke();
    put(doc, leftText, 36, 754, { size: 7, color: '#444' });
    put(doc, `Page ${i + 1} of ${range.count}`, 576, 754, { size: 7, align: 'right', color: '#444' });
  }
}
const PAGE_BOTTOM = 730;

// ------------------------------------------------------------------------------------------------ checking PDF

async function renderCheckingPdf(file, st) {
  const doc = newPdf();
  const { periodStart, periodEnd, opening, rows } = st;
  const deposits = rows.filter((r) => r.amount > 0);
  const withdrawals = rows.filter((r) => r.amount < 0);
  const trueClosing = round2(opening + sum(rows));
  const statedClosing = round2(trueClosing + (st.closingOffset || 0));
  const periodText = `${longDate(periodStart)} through ${longDate(periodEnd)}`;

  const continuationHeader = () => {
    put(doc, 'MAPLE FEDERAL BANK', 36, 36, { font: 'Helvetica-Bold', size: 11, color: '#7a2e0e' });
    put(doc, periodText, 576, 36, { size: 8, align: 'right' });
    put(doc, `Primary Account: ${ACCT.checking.number}`, 576, 47, { size: 8, align: 'right' });
    return 70;
  };
  const tableHeader = (y) => {
    put(doc, 'TRANSACTION DETAIL', 36, y, { font: 'Helvetica-Bold', size: 10 });
    y += 16;
    doc.rect(36, y - 3, 540, 14).fill('#efe6dc');
    put(doc, 'DATE', 40, y, { font: 'Helvetica-Bold' });
    put(doc, 'DESCRIPTION', 80, y, { font: 'Helvetica-Bold' });
    put(doc, 'WITHDRAWALS', 412, y, { font: 'Helvetica-Bold', align: 'right' });
    put(doc, 'DEPOSITS', 487, y, { font: 'Helvetica-Bold', align: 'right' });
    put(doc, 'BALANCE', 572, y, { font: 'Helvetica-Bold', align: 'right' });
    return y + 16;
  };

  // ---- page 1 header
  put(doc, 'MAPLE FEDERAL BANK', 36, 36, { font: 'Helvetica-Bold', size: 16, color: '#7a2e0e' });
  put(doc, 'Member FDIC  |  P.O. Box 8812  |  Fairview, OR 97024-8812', 36, 56, { size: 7, color: '#555' });
  put(doc, periodText, 576, 38, { size: 9, align: 'right' });
  put(doc, `Account Number: ${ACCT.checking.number}`, 576, 50, { size: 9, align: 'right' });
  put(doc, 'Customer Service: 1-800-555-0136', 576, 62, { size: 8, align: 'right' });
  let y = 92;
  for (const line of [...HOUSEHOLD.names, HOUSEHOLD.street, HOUSEHOLD.city]) { put(doc, line, 60, y, { size: 9 }); y += 11; }
  y += 14;
  put(doc, 'MAPLE EVERYDAY CHECKING', 36, y, { font: 'Helvetica-Bold', size: 11 });
  y += 18;
  // ---- summary box
  doc.rect(36, y - 6, 300, 82).lineWidth(0.8).strokeColor('#7a2e0e').stroke();
  put(doc, 'ACCOUNT SUMMARY', 44, y, { font: 'Helvetica-Bold', size: 9 });
  put(doc, 'INSTANCES', 250, y, { font: 'Helvetica-Bold', size: 7, align: 'right' });
  put(doc, 'AMOUNT', 328, y, { font: 'Helvetica-Bold', size: 7, align: 'right' });
  y += 14;
  const summary = [
    ['Beginning Balance', '', money(opening)],
    ['Deposits and Additions', String(deposits.length), fmt(sum(deposits))],
    ['Withdrawals and Subtractions', String(withdrawals.length), `-${fmt(sum(withdrawals))}`],
    ['Ending Balance', String(rows.length), money(statedClosing)],
  ];
  for (const [label, n, amt] of summary) {
    const bold = label.endsWith('Balance');
    put(doc, label, 44, y, { font: bold ? 'Helvetica-Bold' : 'Helvetica', size: 9 });
    put(doc, n, 250, y, { size: 9, align: 'right' });
    put(doc, amt, 328, y, { font: bold ? 'Helvetica-Bold' : 'Helvetica', size: 9, align: 'right' });
    y += 13;
  }
  put(doc, 'Annual Percentage Yield Earned This Period', 360, y - 52, { size: 7 });
  put(doc, '0.01%', 572, y - 52, { size: 7, align: 'right' });
  put(doc, 'Interest Paid Year-to-Date', 360, y - 40, { size: 7 });
  put(doc, money(sum(rows.filter((r) => r.kind === 'interest'))), 572, y - 40, { size: 7, align: 'right' });
  y += 20;
  y = tableHeader(y);

  // ---- transaction rows
  const rowLine = (dateStr, desc, wd, dep, balStr) => {
    if (dateStr) put(doc, dateStr, 40, y);
    put(doc, desc, 80, y);
    if (wd) put(doc, wd, 412, y, { align: 'right' });
    if (dep) put(doc, dep, 487, y, { align: 'right' });
    if (balStr) put(doc, balStr, 572, y, { align: 'right' });
  };
  let rowsOnPage = 0;
  const ensureSpace = (h) => {
    if (y + h > PAGE_BOTTOM || (st.maxRowsPerPage && rowsOnPage >= st.maxRowsPerPage)) {
      doc.addPage();
      y = tableHeader(continuationHeader());
      rowsOnPage = 0;
    }
  };
  rowLine('', 'Beginning Balance', '', '', fmtSigned(opening));
  y += 12;
  let bal = opening;
  for (const r of rows) {
    bal = round2(bal + r.amount);
    const lines = wrap(doc, r.desc, 245);
    ensureSpace(lines.length * 10 + 2);
    rowLine(mmdd(r.date), lines[0], r.amount < 0 ? fmt(r.amount) : '', r.amount > 0 ? fmt(r.amount) : '', fmtSigned(bal));
    for (const extra of lines.slice(1)) { y += 10; put(doc, extra, 80, y); }
    y += 12;
    rowsOnPage++;
  }
  ensureSpace(14);
  rowLine('', 'Ending Balance', '', '', fmtSigned(statedClosing));
  y += 24;

  // ---- daily ending balance (NOT transactions)
  const daily = [];
  bal = opening;
  for (const r of rows) {
    bal = round2(bal + r.amount);
    if (daily.length && daily[daily.length - 1][0] === r.date) daily[daily.length - 1][1] = bal; else daily.push([r.date, bal]);
  }
  if (y + 40 > PAGE_BOTTOM) { doc.addPage(); y = continuationHeader(); }
  put(doc, 'DAILY ENDING BALANCE', 36, y, { font: 'Helvetica-Bold', size: 10 });
  y += 16;
  const perRow = 3;
  for (let i = 0; i < daily.length; i += perRow) {
    if (y + 12 > PAGE_BOTTOM) { doc.addPage(); y = continuationHeader(); put(doc, 'DAILY ENDING BALANCE (continued)', 36, y, { font: 'Helvetica-Bold', size: 10 }); y += 16; }
    daily.slice(i, i + perRow).forEach(([d, b], j) => {
      put(doc, mmdd(d), 40 + j * 180, y);
      put(doc, money(b), 170 + j * 180, y, { align: 'right' });
    });
    y += 12;
  }
  y += 14;
  if (y + 50 > PAGE_BOTTOM) { doc.addPage(); y = continuationHeader(); }
  put(doc, 'IN CASE OF ERRORS OR QUESTIONS ABOUT YOUR ELECTRONIC FUND TRANSFERS:', 36, y, { font: 'Helvetica-Bold', size: 7 });
  y += 10;
  for (const t of [
    'Call us at 1-800-555-0136 or write us at the address on the front of this statement as soon as you can, if you think your',
    'statement or receipt is incorrect. We must hear from you no later than 60 days after we sent you the FIRST statement on which',
    'the problem or error appeared. Maple Federal Bank is a fictional institution used for software testing.',
  ]) { put(doc, t, 36, y, { size: 7, color: '#444' }); y += 9; }

  addFooters(doc, `Maple Federal Bank  |  ${ACCT.checking.name}  |  ${ACCT.checking.masked}`);
  await writePdf(doc, file);
  return { opening, closing: statedClosing, trueClosing };
}

// ------------------------------------------------------------------------------------------------ Summit PDF

async function renderSummitPdf(file, st) {
  const doc = newPdf();
  const { start, end, opening, rows } = st;
  const payments = rows.filter((r) => r.kind === 'payment');
  const otherCredits = rows.filter((r) => r.section === 'credit' && r.kind !== 'payment');
  const purchases = rows.filter((r) => r.section === 'purchase');
  const fees = rows.filter((r) => r.section === 'fee');
  const interest = rows.filter((r) => r.section === 'interest');
  const closing = round2(opening - sum(rows));
  const minDue = Math.max(35, round2(Math.round(closing * 0.01) - sum(interest) - sum(fees)));
  const due = addDays(end, 25);
  const days = (toDate(end) - toDate(start)) / 86400000 + 1;
  const creditLimit = 15000;
  const disp = (r) => fmtSigned(-r.amount); // statement convention: purchases positive, credits negative

  const header = (first) => {
    put(doc, 'SUMMIT CARD SERVICES', 36, 36, { font: 'Helvetica-Bold', size: first ? 15 : 11, color: '#1d3b6b' });
    put(doc, `Summit Rewards Visa Signature  |  Account Number: ${ACCT.summit.masked}`, 36, first ? 54 : 50, { size: 8 });
    put(doc, `Opening/Closing Date ${mdyShort(start)} - ${mdyShort(end)}`, 576, 38, { size: 8, align: 'right' });
    return first ? 76 : 70;
  };
  const activityHeader = (y) => {
    doc.rect(36, y - 3, 540, 14).fill('#dfe7f2');
    put(doc, 'Trans Date', 40, y, { font: 'Helvetica-Bold' });
    put(doc, 'Post Date', 88, y, { font: 'Helvetica-Bold' });
    put(doc, 'Description', 140, y, { font: 'Helvetica-Bold' });
    put(doc, 'Amount', 572, y, { font: 'Helvetica-Bold', align: 'right' });
    return y + 16;
  };

  let y = header(true);
  // payment information (left) & account summary (right): same baselines -> extraction merges them per line
  doc.rect(36, y, 250, 112).lineWidth(0.8).strokeColor('#1d3b6b').stroke();
  doc.rect(306, y, 270, 160).lineWidth(0.8).strokeColor('#1d3b6b').stroke();
  let ly = y + 8;
  let ry = y + 8;
  put(doc, 'PAYMENT INFORMATION', 44, ly, { font: 'Helvetica-Bold', size: 9 });
  put(doc, 'ACCOUNT SUMMARY', 314, ry, { font: 'Helvetica-Bold', size: 9 });
  ly += 16; ry += 16;
  for (const [l, v] of [['New Balance', money(closing)], ['Minimum Payment Due', money(minDue)], ['Payment Due Date', mdyShort(due)]]) {
    put(doc, l, 44, ly, { size: 9, font: 'Helvetica-Bold' }); put(doc, v, 278, ly, { size: 9, align: 'right', font: 'Helvetica-Bold' }); ly += 14;
  }
  for (const t of ['Late Payment Warning: If we do not receive your minimum', 'payment by the date listed above, you may have to pay', 'a late fee of up to $41.00 and your APRs may be increased.']) {
    put(doc, t, 44, ly, { size: 6.5, color: '#444' }); ly += 9;
  }
  const summaryLines = [
    ['Previous Balance', money(opening)],
    ['Payment, Credits', `-${money(sum(payments) + sum(otherCredits))}`],
    ['Purchases', `+${money(-sum(purchases))}`],
    ['Cash Advances', '+$0.00'],
    ['Balance Transfers', '+$0.00'],
    ['Fees Charged', `+${money(-sum(fees))}`],
    ['Interest Charged', `+${money(-sum(interest))}`],
    ['New Balance', money(closing)],
    ['Credit Limit', money(creditLimit)],
    ['Available Credit', money(round2(creditLimit - closing))],
  ];
  for (const [l, v] of summaryLines) {
    const b = l === 'New Balance';
    put(doc, l, 314, ry, { size: 8.5, font: b ? 'Helvetica-Bold' : 'Helvetica' });
    put(doc, v, 568, ry, { size: 8.5, align: 'right', font: b ? 'Helvetica-Bold' : 'Helvetica' });
    ry += 12;
  }
  put(doc, `Days in Billing Cycle: ${days}`, 314, ry, { size: 7.5 });
  y = Math.max(ly, ry) + 26;

  put(doc, 'ACCOUNT ACTIVITY', 36, y, { font: 'Helvetica-Bold', size: 11, color: '#1d3b6b' });
  y = activityHeader(y + 16);

  const ensure = (h) => {
    if (y + h > PAGE_BOTTOM || (st.maxRowsPerPage && rowsOnPage >= st.maxRowsPerPage)) {
      doc.addPage();
      y = header(false);
      put(doc, 'ACCOUNT ACTIVITY (CONTINUED)', 36, y, { font: 'Helvetica-Bold', size: 10, color: '#1d3b6b' });
      y = activityHeader(y + 16);
      rowsOnPage = 0;
    }
  };
  let rowsOnPage = 0;
  const section = (title, list, totalLabel) => {
    ensure(30);
    put(doc, title, 40, y, { font: 'Helvetica-Bold', size: 9 });
    y += 13;
    for (const r of list) {
      const lines = wrap(doc, r.desc, 250);
      ensure(lines.length * 10 + 2);
      put(doc, mmdd(r.transDate), 40, y);
      put(doc, mmdd(r.postDate), 88, y);
      put(doc, lines[0], 140, y);
      put(doc, disp(r), 572, y, { align: 'right' });
      for (const extra of lines.slice(1)) { y += 10; put(doc, extra, 140, y); }
      y += 12;
      rowsOnPage++;
    }
    if (totalLabel) {
      ensure(14);
      const t = -sum(list);
      put(doc, totalLabel, 140, y, { font: 'Helvetica-Bold' });
      put(doc, `${t < 0 ? '-' : ''}$${fmt(t)}`, 572, y, { font: 'Helvetica-Bold', align: 'right' });
      y += 18;
    } else y += 6;
  };
  section('PAYMENTS AND OTHER CREDITS', [...payments, ...otherCredits].sort(byDate('postDate')), null);
  section('PURCHASES', purchases.sort(byDate('postDate')), null);
  section('FEES CHARGED', fees, 'TOTAL FEES FOR THIS PERIOD');
  section('INTEREST CHARGED', interest, 'TOTAL INTEREST FOR THIS PERIOD');

  // year-to-date + interest calculation (must NOT be parsed as transactions)
  const yr = end.slice(0, 4);
  ensure(140);
  put(doc, `${yr} Totals Year-to-Date`, 40, y, { font: 'Helvetica-Bold', size: 9 }); y += 13;
  put(doc, `Total fees charged in ${yr}`, 40, y); put(doc, money(st.ytdFees), 300, y, { align: 'right' }); y += 11;
  put(doc, `Total interest charged in ${yr}`, 40, y); put(doc, money(st.ytdInterest), 300, y, { align: 'right' }); y += 22;
  put(doc, 'INTEREST CHARGE CALCULATION', 36, y, { font: 'Helvetica-Bold', size: 10, color: '#1d3b6b' }); y += 13;
  put(doc, 'Your Annual Percentage Rate (APR) is the annual interest rate on your account.', 36, y, { size: 7 }); y += 12;
  doc.rect(36, y - 3, 540, 14).fill('#dfe7f2');
  put(doc, 'Balance Type', 40, y, { font: 'Helvetica-Bold' });
  put(doc, 'Annual Percentage Rate (APR)', 300, y, { font: 'Helvetica-Bold', align: 'right' });
  put(doc, 'Balance Subject to Interest Rate', 460, y, { font: 'Helvetica-Bold', align: 'right' });
  put(doc, 'Interest Charges', 572, y, { font: 'Helvetica-Bold', align: 'right' });
  y += 15;
  const subj = interest[0] ? interest[0].avgDaily : 0;
  for (const [type, apr, bal, ic] of [
    ['PURCHASES', `${SUMMIT_APR.toFixed(2)}%(v)(d)`, money(subj), money(-sum(interest))],
    ['CASH ADVANCES', '29.99%(v)(d)', '$0.00', '$0.00'],
    ['BALANCE TRANSFERS', `${SUMMIT_APR.toFixed(2)}%(v)(d)`, '$0.00', '$0.00'],
  ]) {
    put(doc, type, 40, y); put(doc, apr, 300, y, { align: 'right' }); put(doc, bal, 460, y, { align: 'right' }); put(doc, ic, 572, y, { align: 'right' });
    y += 12;
  }
  y += 6;
  put(doc, '(v) = Variable Rate  (d) = Daily Balance Method (including new transactions)', 36, y, { size: 6.5, color: '#444' });

  addFooters(doc, `Summit Card Services (fictional)  |  Statement closing date ${mdy(end)}`);
  await writePdf(doc, file);
  return { opening, closing };
}

// ------------------------------------------------------------------------------------------------ CSV / OFX / TXT writers

function csvField(v) {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csvLine = (fields) => fields.map(csvField).join(',');

function writeCheckingCsv(file, st) {
  // newest first, Debit/Credit as positive numbers, running balance; 2-line preamble then a blank line
  const lines = [
    'Maple Federal Bank - Account Activity Export',
    `Account: ${ACCT.checking.name} ${ACCT.checking.masked}  Date Range: ${mdy(st.periodStart)} - ${mdy(st.periodEnd)}`,
    '',
    csvLine(['Date', 'Description', 'Debit', 'Credit', 'Balance']),
  ];
  let bal = st.opening;
  const withBal = st.rows.map((r) => ({ ...r, bal: (bal = round2(bal + r.amount)) }));
  for (const r of withBal.slice().reverse()) {
    lines.push(csvLine([mdy(r.date), r.desc, r.amount < 0 ? plain(-r.amount) : '', r.amount > 0 ? plain(r.amount) : '', plain(r.bal)]));
  }
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
  return { opening: st.opening, closing: bal };
}

function writeHarborCsv(file, st) {
  // UTF-8 BOM + CRLF, newest first, purchases negative / payments positive
  const lines = [csvLine(['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount'])];
  for (const r of st.rows.slice().reverse()) lines.push(csvLine([mdy(r.transDate), mdy(r.postDate), r.desc, r.category, r.type, plain(r.amount)]));
  fs.writeFileSync(file, '﻿' + lines.join('\r\n') + '\r\n', 'utf8');
}

const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ofxName = (desc) => desc.slice(0, 32).trimEnd(); // OFX NAME is max 32 chars; banks truncate

function writeCheckingOfx(file, st) {
  // OFX 2.2 XML. NAME truncated to 32 chars; MEMO carries the full text when truncated.
  const trns = st.rows.map((r, i) => {
    const name = ofxName(r.desc);
    const type = r.kind === 'check' ? 'CHECK' : r.kind === 'atm' ? 'ATM' : r.kind.startsWith('xfer') ? 'XFER' : r.kind === 'interest' ? 'INT' : r.amount < 0 ? 'DEBIT' : 'CREDIT';
    return [
      '<STMTTRN>',
      `<TRNTYPE>${type}</TRNTYPE>`,
      `<DTPOSTED>${ymd(r.date)}120000.000[-8:PST]</DTPOSTED>`,
      `<TRNAMT>${plain(r.amount)}</TRNAMT>`,
      `<FITID>MFB${ymd(r.date)}${String(i + 1).padStart(4, '0')}${String(Math.round(Math.abs(r.amount) * 100) % 9973).padStart(4, '0')}</FITID>`,
      r.kind === 'check' ? `<CHECKNUM>${r.desc.replace(/\D/g, '')}</CHECKNUM>` : null,
      `<NAME>${xmlEsc(name)}</NAME>`,
      name !== r.desc ? `<MEMO>${xmlEsc(r.desc)}</MEMO>` : null,
      '</STMTTRN>',
    ].filter(Boolean).map((l) => '            ' + l).join('\n');
  });
  const closing = round2(st.opening + sum(st.rows));
  const asof = `${ymd(st.periodEnd)}235959.000[-8:PST]`;
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<?OFX OFXHEADER="200" VERSION="220" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
      <DTSERVER>${ymd(addDays(st.periodEnd, 1))}080000.000[-8:PST]</DTSERVER>
      <LANGUAGE>ENG</LANGUAGE>
      <FI><ORG>MAPLEFED</ORG><FID>99021</FID></FI>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>0</TRNUID>
      <STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
      <STMTRS>
        <CURDEF>USD</CURDEF>
        <BANKACCTFROM>
          <BANKID>999990213</BANKID>
          <ACCTID>${ACCT.checking.number}</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>${ymd(st.periodStart)}000000.000[-8:PST]</DTSTART>
          <DTEND>${ymd(st.periodEnd)}235959.000[-8:PST]</DTEND>
${trns.join('\n')}
        </BANKTRANLIST>
        <LEDGERBAL><BALAMT>${plain(closing)}</BALAMT><DTASOF>${asof}</DTASOF></LEDGERBAL>
        <AVAILBAL><BALAMT>${plain(closing)}</BALAMT><DTASOF>${asof}</DTASOF></AVAILBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`;
  fs.writeFileSync(file, xml, 'utf8');
  return { closing };
}

function writeHarborQfx(file, st) {
  // OFX 1.02 SGML: key:value header, blank line, unclosed leaf tags, CRLF. Card LEDGERBAL is negative (= owed).
  const L = [
    'OFXHEADER:100', 'DATA:OFXSGML', 'VERSION:102', 'SECURITY:NONE', 'ENCODING:USASCII', 'CHARSET:1252',
    'COMPRESSION:NONE', 'OLDFILEUID:NONE', 'NEWFILEUID:NONE', '',
    '<OFX>', '<SIGNONMSGSRSV1>', '<SONRS>', '<STATUS>', '<CODE>0', '<SEVERITY>INFO', '</STATUS>',
    `<DTSERVER>${ymd(addDays(st.periodEnd, 1))}061512.000[-5:EST]`, '<LANGUAGE>ENG',
    '<FI>', '<ORG>HARBORBANK', '<FID>40417', '</FI>', '<INTU.BID>40417', '</SONRS>', '</SIGNONMSGSRSV1>',
    '<CREDITCARDMSGSRSV1>', '<CCSTMTTRNRS>', '<TRNUID>0', '<STATUS>', '<CODE>0', '<SEVERITY>INFO', '</STATUS>',
    '<CCSTMTRS>', '<CURDEF>USD', '<CCACCTFROM>', `<ACCTID>${ACCT.harbor.masked}`, '</CCACCTFROM>',
    '<BANKTRANLIST>', `<DTSTART>${ymd(st.periodStart)}050000.000[-5:EST]`, `<DTEND>${ymd(st.periodEnd)}050000.000[-5:EST]`,
  ];
  st.rows.forEach((r, i) => {
    L.push('<STMTTRN>',
      `<TRNTYPE>${r.amount < 0 ? 'DEBIT' : 'CREDIT'}`,
      `<DTPOSTED>${ymd(r.postDate)}050000.000[-5:EST]`,
      `<TRNAMT>${plain(r.amount)}`,
      `<FITID>${ymd(r.postDate)}${String(24492154301 + i * 7919).padStart(11, '0')}${String(i + 1).padStart(3, '0')}`,
      `<NAME>${xmlEsc(ofxName(r.desc))}`,
      '</STMTTRN>');
  });
  L.push('</BANKTRANLIST>', '<LEDGERBAL>', `<BALAMT>${plain(-st.closing)}`, `<DTASOF>${ymd(st.periodEnd)}050000.000[-5:EST]`, '</LEDGERBAL>',
    '</CCSTMTRS>', '</CCSTMTTRNRS>', '</CREDITCARDMSGSRSV1>', '</OFX>');
  fs.writeFileSync(file, L.join('\r\n') + '\r\n', 'latin1');
}

function writeTxt(file, rows) {
  fs.writeFileSync(file, rows.map((r) => `${r.date} ${r.desc} ${plain(r.amount)}`).join('\n') + '\n', 'utf8');
}

// ------------------------------------------------------------------------------------------------ statements

function checkingStatement(L, ym) {
  const m = L.checking.months.find((x) => x.ym === ym);
  return { periodStart: `${ym}-01`, periodEnd: lastDayOfMonth(ym), opening: m.opening, rows: L.checking.rows.filter((r) => r.date.startsWith(ym)) };
}
function summitStatement(L, ym) {
  const c = L.summit.cycles.find((x) => x.ym === ym);
  const yr = c.end.slice(0, 4);
  const ytd = L.summit.rows.filter((r) => r.postDate.startsWith(yr) && r.postDate <= c.end);
  return {
    start: c.start, end: c.end, opening: c.opening,
    rows: L.summit.rows.filter((r) => inRange(r.postDate, c.start, c.end)),
    ytdFees: -sum(ytd.filter((r) => r.section === 'fee')),
    ytdInterest: -sum(ytd.filter((r) => r.section === 'interest')) + (yr === '2024' ? 512.37 : 0), // Jan-Oct 2024 not generated
  };
}
function harborStatement(L, ym) {
  const m = L.harbor.months.find((x) => x.ym === ym);
  return { periodStart: `${ym}-01`, periodEnd: lastDayOfMonth(ym), opening: m.opening, closing: m.closing, rows: L.harbor.rows.filter((r) => r.transDate.startsWith(ym)) };
}

/** Pick a small, representative subset: first match for each predicate, then evenly spaced fillers; original order kept. */
function subset(rows, n, preds) {
  const chosen = new Set();
  for (const p of preds) { const r = rows.find((x) => !chosen.has(x) && p(x)); if (!r) throw new Error(`fixture predicate matched nothing: ${p}`); chosen.add(r); }
  const rest = rows.filter((r) => !chosen.has(r));
  const need = Math.min(rest.length, n - chosen.size);
  for (let i = 0; i < need; i++) chosen.add(rest[Math.floor((i * rest.length) / need)]);
  return rows.filter((r) => chosen.has(r));
}

function expected(acct, periodStart, periodEnd, txns, extra = {}) {
  const out = { account: acct.name, accountType: acct.type, periodStart, periodEnd };
  Object.assign(out, extra);
  out.transactions = txns
    .map((t) => ({ date: t.date, description: t.description, amount: round2(t.amount) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}
function writeExpected(file, obj) { fs.writeFileSync(`${file}.expected.json`, JSON.stringify(obj, null, 2) + '\n', 'utf8'); }

// ------------------------------------------------------------------------------------------------ main

async function generateData(L, outRoot, { outMonths = MONTHS, demo = false } = {}) {
  const made = [];
  const dirFor = (ym) => { const d = path.join(outRoot, ym); fs.mkdirSync(d, { recursive: true }); return d; };
  for (const ym of outMonths) {
    const dir = dirFor(ym);
    const ck = checkingStatement(L, ym);
    if (demo && ym === DEMO_MISMATCH_MONTH) ck.closingOffset = 42.17; // deliberate reconciliation failure
    let f = path.join(dir, `${baseName(ACCT.checking, ym)}.pdf`); await renderCheckingPdf(f, ck); made.push([f, ck.rows.length]);
    if (demo && ym === DEMO_LIVE_MONTH) continue; // live month: only checking is pre-loaded
    f = path.join(dir, `${baseName(ACCT.summit, ym)}.pdf`); const ss = summitStatement(L, ym); await renderSummitPdf(f, ss); made.push([f, ss.rows.length]);
    const hs = harborStatement(L, ym);
    if (ym === '2024-11') { f = path.join(dir, `${baseName(ACCT.harbor, ym)}.qfx`); writeHarborQfx(f, hs); }
    else { f = path.join(dir, `${baseName(ACCT.harbor, ym)}.csv`); writeHarborCsv(f, hs); }
    made.push([f, hs.rows.length]);
    if (ym === '2025-01') {
      f = path.join(dir, `${baseName(ACCT.checking, ym)}.csv`); writeCheckingCsv(f, ck); made.push([f, ck.rows.length]);
      f = path.join(dir, `${baseName(ACCT.checking, ym)}.ofx`); writeCheckingOfx(f, ck); made.push([f, ck.rows.length]);
    }
    const sv = L.savings.rows.filter((r) => r.date.startsWith(ym));
    if (demo ? sv.length : ym === '2024-12') { f = path.join(dir, `${baseName(ACCT.savings, ym)}.txt`); writeTxt(f, sv); made.push([f, sv.length]); }
  }
  return made;
}

/**
 * Demo upload: a small Summit statement for the live month (cycle 02/05-03/04, rows only through 02/28).
 * Designed so most rows hit pre-staged rules (AMZN MKTP, SHELL, NETFLIX, COSTCO WHSE) or the coffee rule created live
 * (BLUE BOTTLE COFFEE), the payment pairs with the pre-loaded checking statement, and only 4 merchants go to Gemma.
 */
async function generateDemoUpload(L, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const ym = DEMO_LIVE_MONTH;
  const c = L.summit.cycles.find((x) => x.ym === ym);
  const rng = new Rng(0xde70);
  const pay = L.summit.rows.find((r) => r.kind === 'payment' && inRange(r.postDate, c.start, c.end));
  const P = (transDate, desc, amount, kind, lag = 1) =>
    ({ transDate, postDate: addDays(transDate, lag), desc, amount: round2(amount), section: 'purchase', kind, seq: SEQ++ });
  const rows = [
    { ...pay },
    P(`${ym}-03`, 'SQ *LITTLE STARS DANCE ACADEMY FAIRVIEW OR', -95.0, 'kids', 2),
    P(`${ym}-06`, 'SQ *BLUE BOTTLE COFFEE OAKLAND CA', -rng.amount(5, 9), 'coffee'),
    P(`${ym}-07`, 'COSTCO WHSE #0681 WOOD VILLAGE OR', -rng.amount(140, 230), 'grocery'),
    P(`${ym}-09`, 'SPOTIFY USA 877-778-1161 NY', -16.99, 'streaming', 0),
    P(`${ym}-11`, `AMZN Mktp US*${rng.code(6)} Amzn.com/bill WA`, -rng.amount(20, 80), 'amazon'),
    P(`${ym}-13`, 'SQ *BLUE BOTTLE COFFEE OAKLAND CA', -rng.amount(5, 9), 'coffee'),
    P(`${ym}-14`, 'TST* PINE STATE BISCUITS PORTLAND OR', -rng.amount(40, 70), 'restaurant'),
    P(`${ym}-15`, 'NETFLIX.COM 866-579-7172 CA', -22.99, 'streaming', 0),
    P(`${ym}-18`, 'SHELL OIL 57442110021 FAIRVIEW OR', -rng.amount(40, 65), 'gas'),
    P(`${ym}-22`, 'REI #57 PORTLAND OR', -rng.amount(60, 120), 'shopping', 2),
    P(`${ym}-24`, `AMZN Mktp US*${rng.code(6)} Amzn.com/bill WA`, -rng.amount(15, 60), 'amazon'),
    P(`${ym}-26`, 'SQ *BLUE BOTTLE COFFEE OAKLAND CA', -rng.amount(5, 9), 'coffee'),
  ];
  const f = path.join(dir, `${baseName(ACCT.summit, ym)}.pdf`);
  await renderSummitPdf(f, { start: c.start, end: c.end, opening: c.opening, rows, ytdFees: 0, ytdInterest: 0 });
  return [[f, rows.length]];
}

async function generateFixtures(L, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const made = [];
  const k = (kind) => (r) => r.kind === kind;
  const has = (s) => (r) => r.desc.includes(s);
  const ckTx = (rows) => rows.map((r) => ({ date: r.date, description: r.desc, amount: r.amount }));

  // 1. checking PDF, December: multi-page, wrapped rows, every transfer flavour
  {
    const full = checkingStatement(L, '2024-12');
    const rows = subset(full.rows, 18, [k('payroll'), k('mortgage'), k('xfer-savings'), has('POWER & LIGHT'), k('refund'), k('atm'), k('fee'),
      k('check'), has('POS DEBIT'), has('DEBIT CARD PURCHASE'), k('xfer-from-savings'), (r) => r.kind === 'card-payment' && r.desc.includes('SUMMIT'),
      (r) => r.kind === 'card-payment' && r.desc.includes('HARBOR'), k('xfer-unpaired'), k('interest')]);
    const st = { ...full, rows, maxRowsPerPage: 9 };
    const f = path.join(dir, `${baseName(ACCT.checking, '2024-12')}.pdf`);
    const b = await renderCheckingPdf(f, st);
    writeExpected(f, expected(ACCT.checking, st.periodStart, st.periodEnd, ckTx(rows), { openingBalance: b.opening, closingBalance: b.closing, expectReconciliation: 'ok' }));
    made.push([f, rows.length]);
  }
  // 2. checking PDF, November: deliberately broken summary (+42.17)
  {
    const full = checkingStatement(L, '2024-11');
    const rows = subset(full.rows, 10, [k('payroll'), k('mortgage'), k('xfer-savings'), has('POS DEBIT'), k('atm')]);
    const st = { ...full, rows, closingOffset: 42.17 };
    const f = path.join(dir, `${baseName(ACCT.checking, '2024-11')}.pdf`);
    const b = await renderCheckingPdf(f, st);
    writeExpected(f, expected(ACCT.checking, st.periodStart, st.periodEnd, ckTx(rows), {
      openingBalance: b.opening, closingBalance: b.closing, expectReconciliation: 'mismatch',
      reconciliationNote: `Summary box and Ending Balance line state ${plain(b.closing)}; opening + sum(rows) = ${plain(b.trueClosing)} (stated is 42.17 higher).`,
    }));
    made.push([f, rows.length]);
  }
  // 3+4. checking CSV and OFX, January (same rows, same basename -> OFX wins by preference)
  {
    const full = checkingStatement(L, '2025-01');
    const rows = subset(full.rows, 12, [k('payroll'), has('POWER & LIGHT'), k('check'), k('atm'), has('POS DEBIT'), k('card-payment'), k('mobile-deposit'), k('venmo'), k('interest')]);
    const st = { ...full, rows };
    let f = path.join(dir, `${baseName(ACCT.checking, '2025-01')}.csv`);
    const b = writeCheckingCsv(f, st);
    writeExpected(f, expected(ACCT.checking, st.periodStart, st.periodEnd, ckTx(rows), { openingBalance: b.opening, closingBalance: b.closing, expectReconciliation: 'ok' }));
    made.push([f, rows.length]);
    f = path.join(dir, `${baseName(ACCT.checking, '2025-01')}.ofx`);
    const o = writeCheckingOfx(f, st);
    writeExpected(f, expected(ACCT.checking, st.periodStart, st.periodEnd, ckTx(rows), { closingBalance: o.closing, expectReconciliation: 'unknown' }));
    made.push([f, rows.length]);
  }
  // 5. Summit PDF, December cycle 12/05/2024 - 01/04/2025
  {
    const full = summitStatement(L, '2024-12');
    const rows = subset(full.rows, 16, [k('payment'), k('refund'), k('fee'), k('interest'), k('foreign'), k('travel'), k('amazon'), has('SQ *'), has('TST*'),
      k('streaming'), (r) => r.section === 'purchase' && r.transDate >= '2025-01-01', (r) => r.section === 'purchase' && r.transDate >= '2025-01-02' && r.kind !== 'streaming']);
    const st = { ...full, rows, maxRowsPerPage: 12 };
    const f = path.join(dir, `${baseName(ACCT.summit, '2024-12')}.pdf`);
    const b = await renderSummitPdf(f, st);
    writeExpected(f, expected(ACCT.summit, st.start, st.end, rows.map((r) => ({ date: r.transDate, description: r.desc, amount: r.amount })),
      { openingBalance: b.opening, closingBalance: b.closing, expectReconciliation: 'ok' }));
    made.push([f, rows.length]);
  }
  // 6. Harbor CSV, December
  {
    const full = harborStatement(L, '2024-12');
    const rows = subset(full.rows, 12, [k('payment'), k('refund'), has(', '), has('&'), k('streaming'), k('grocery'), k('rideshare')]);
    const f = path.join(dir, `${baseName(ACCT.harbor, '2024-12')}.csv`);
    writeHarborCsv(f, { ...full, rows });
    writeExpected(f, expected(ACCT.harbor, full.periodStart, full.periodEnd, rows.map((r) => ({ date: r.transDate, description: r.desc, amount: r.amount })), { expectReconciliation: 'unknown' }));
    made.push([f, rows.length]);
  }
  // 7. Harbor QFX (OFX 1.x SGML), November
  {
    const full = harborStatement(L, '2024-11');
    const rows = subset(full.rows, 10, [k('payment'), has('&'), has(', '), (r) => r.desc.length > 32, k('streaming')]);
    const closing = round2(full.opening - sum(rows));
    const f = path.join(dir, `${baseName(ACCT.harbor, '2024-11')}.qfx`);
    writeHarborQfx(f, { ...full, rows, closing });
    writeExpected(f, expected(ACCT.harbor, full.periodStart, full.periodEnd, rows.map((r) => ({ date: r.postDate, description: ofxName(r.desc), amount: r.amount })),
      { closingBalance: closing, expectReconciliation: 'unknown' }));
    made.push([f, rows.length]);
  }
  // 8. Savings TXT, December (old regex format)
  {
    const f = path.join(dir, `${baseName(ACCT.savings, '2024-12')}.txt`);
    writeTxt(f, L.savings.rows);
    writeExpected(f, expected(ACCT.savings, '2024-12-01', '2024-12-31', L.savings.rows.map((r) => ({ date: r.date, description: r.desc, amount: r.amount })), { expectReconciliation: 'unknown' }));
    made.push([f, L.savings.rows.length]);
  }
  return made;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let made;
  if (opts.fixtures) {
    made = await generateFixtures(buildLedgers(), opts.out);
  } else if (opts.demo) {
    // Demo: history ${DEMO_FROM}..month before the live month, all accounts; live month = checking only (+ upload file)
    const months = monthRange(opts.from || DEMO_FROM, opts.to || DEMO_LIVE_MONTH);
    if (!months.includes(DEMO_LIVE_MONTH) || !months.includes(DEMO_MISMATCH_MONTH)) throw new Error(`--demo range must include ${DEMO_MISMATCH_MONTH} and ${DEMO_LIVE_MONTH}`);
    const L = buildLedgers(months, { demo: true });
    // the output folder must mirror the demo DB snapshot exactly: remove stale month folders (uploads, old months)
    if (fs.existsSync(opts.out)) {
      for (const d of fs.readdirSync(opts.out)) {
        if (!/^\d{4}-\d{2}$/.test(d)) continue;
        const p = path.join(opts.out, d);
        fs.rmSync(p, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }); // Windows: file may be briefly locked
        if (fs.existsSync(p)) throw new Error(`Could not remove ${p} (file in use?)`);
      }
    }
    made = await generateData(L, opts.out, { demo: true });
    made.push(...(await generateDemoUpload(L, opts.uploadDir)));
  } else {
    const months = opts.from || opts.to ? monthRange(opts.from || DEFAULT_MONTHS[0], opts.to || DEFAULT_MONTHS[DEFAULT_MONTHS.length - 1]) : DEFAULT_MONTHS;
    made = await generateData(buildLedgers(months), opts.out);
  }
  for (const [f, n] of made) console.log(`Generated ${f} (${n} transactions)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
