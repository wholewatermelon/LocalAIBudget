'use strict';
/* Shared helpers for scripts/demo-prepare.js and scripts/demo-reset.js. No network beyond 127.0.0.1. */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });

const API = process.env.DEMO_API || 'http://127.0.0.1:3000/api';
const OLLAMA = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL || 'gemma4';
const PG_BIN = process.env.PG_BIN || 'C:\\Program Files\\PostgreSQL\\18\\bin';
const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '5432',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'localaibudget',
};
const SNAPSHOT = path.join(ROOT, 'demo', 'snapshot.sql');
const UPLOAD_DIR = path.join(ROOT, 'demo', 'upload');
const STATEMENTS_DIR = path.resolve(ROOT, process.env.STATEMENTS_DIR || path.join('data', 'statements'));

const DEMO_MONTHS = ['2024-08', '2024-09', '2024-10', '2024-11', '2024-12', '2025-01', '2025-02'];
const LIVE_MONTH = '2025-02';
const COFFEE = 'BLUE BOTTLE COFFEE';

if (!DB.password) {
  console.error('DB_PASSWORD missing: create .env at the repo root (see README).');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const elapsed = (since = t0) => `${((Date.now() - since) / 1000).toFixed(1)}s`;
const log = (msg) => console.log(`[${elapsed()}] ${msg}`);

/** True for connection-level failures (dev server restarting in watch mode), not for HTTP errors. */
const isNetworkError = (err) => err instanceof TypeError && /fetch failed/.test(err.message);

/** JSON API call. Retries for up to ~2 min while the (watch-mode) dev server is restarting. */
async function api(method, url, body, opts = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await apiOnce(method, url, body, opts);
    } catch (err) {
      if (!isNetworkError(err) || attempt > 24) throw err;
      if (attempt === 1) console.log(`  (${method} ${url}: ${err.cause && err.cause.code || err.message} — API restarting? retrying)`);
      await sleep(5000);
    }
  }
}

async function apiOnce(method, url, body, { timeoutMs = 600000, okStatuses } = {}) {
  const init = { method, headers: {}, signal: AbortSignal.timeout(timeoutMs) };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['content-type'] = 'application/json';
  }
  const res = await fetch(API + url, init);
  const text = await res.text();
  if (!res.ok && !(okStatuses || []).includes(res.status)) {
    throw new Error(`${method} ${url} -> ${res.status} ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Runs a PostgreSQL client tool (psql, pg_dump) with the password from .env. */
function pgTool(tool, args, { input } = {}) {
  const exe = path.join(PG_BIN, process.platform === 'win32' ? `${tool}.exe` : tool);
  const r = spawnSync(exe, ['-h', DB.host, '-p', String(DB.port), '-U', DB.user, ...args], {
    env: { ...process.env, PGPASSWORD: DB.password },
    input,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) throw new Error(`${tool}: ${r.error.message} (set PG_BIN to the PostgreSQL bin directory)`);
  if (r.status !== 0) throw new Error(`${tool} exited ${r.status}: ${(r.stderr || '').slice(0, 1000)}`);
  return r.stdout;
}

function sql(query) {
  return pgTool('psql', ['-d', DB.database, '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A', '-F', '\t', '-c', query]).trim();
}

function generateDemoStatements() {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'generate-fake-statements.js'), '--demo',
    '--out', STATEMENTS_DIR, '--upload-dir', UPLOAD_DIR], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`generator failed: ${r.stderr}`);
  return r.stdout.trim().split('\n').length;
}

async function health() {
  try {
    return await api('GET', '/health', undefined, { timeoutMs: 15000 });
  } catch (err) {
    return { error: err.message };
  }
}

/** Loads the model into memory (keep_alive 60m) so the first live categorization isn't a cold start. */
async function warmGemma() {
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: 'Reply with OK.', stream: false, keep_alive: process.env.OLLAMA_KEEP_ALIVE || '60m', think: false, options: { num_predict: 4 } }),
    signal: AbortSignal.timeout(300000),
  });
  if (!res.ok) throw new Error(`Ollama warm-up failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function activeJobs() {
  const jobs = await api('GET', '/jobs?limit=50');
  return jobs.filter((j) => j.status === 'queued' || j.status === 'running');
}

/** Starts a process job and waits for it. Retries when the dev server restarted underneath it (watch mode). */
async function processMonth(month, mode = 'incremental', { retries = 3, quiet = false } = {}) {
  for (let attempt = 1; ; attempt++) {
    let job;
    try {
      job = await api('POST', '/jobs/process', { month, mode });
    } catch (err) {
      if (attempt <= retries && /ECONNREFUSED|fetch failed|409/.test(String(err.message) + String(err.cause))) {
        if (!quiet) log(`  ${month}: server busy/unreachable (${err.message.slice(0, 80)}), retrying in 10s`);
        await sleep(10000);
        continue;
      }
      throw err;
    }
    const started = Date.now();
    for (;;) {
      await sleep(1000);
      try {
        job = await api('GET', `/jobs/${job.id}`, undefined, { timeoutMs: 30000 });
      } catch {
        continue; // server restarting; keep polling
      }
      if (job.status === 'completed' || job.status === 'failed') break;
    }
    job.seconds = (Date.now() - started) / 1000;
    if (job.status === 'completed') return job;
    if (attempt <= retries && /Server restarted/i.test(job.message || '')) {
      if (!quiet) log(`  ${month}: job ${job.id} failed with "${job.message}" — retrying`);
      await sleep(5000);
      continue;
    }
    throw new Error(`Job ${job.id} for ${month} failed: ${job.message}`);
  }
}

module.exports = {
  ROOT, API, OLLAMA, MODEL, DB, SNAPSHOT, UPLOAD_DIR, STATEMENTS_DIR, DEMO_MONTHS, LIVE_MONTH, COFFEE,
  sleep, elapsed, log, api, pgTool, sql, generateDemoStatements, health, warmGemma, activeJobs, processMonth, fs, path,
};
