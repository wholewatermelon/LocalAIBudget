# LocalAI Budget — server (NestJS 11)

Local-only REST API (`http://127.0.0.1:3000/api`) that imports bank/card statements (OFX/QFX, CSV, PDF, TXT), categorizes
them with rules → transfer matching → local Gemma (Ollama), and serves budgets/insights to the Angular client.
**The API contract is `docs/ARCHITECTURE.md`** (sections A–G at the bottom extend/override the top).

## Run

```bash
cd server
npm install
npm run migrate          # creates/updates the DB named by DB_NAME (default localaibudget)
npm run start:dev        # watch mode, http://127.0.0.1:3000/api
# or: npm run build && npm run start:prod
```

From the repo root `npm run dev` starts server + client. The server binds to **127.0.0.1 only**.

## Environment (repo-root `.env`, loaded via @nestjs/config; real env vars win)

| Var | Default |
|---|---|
| `DB_HOST` / `DB_PORT` / `DB_USER` | `localhost` / `5432` / `postgres` |
| `DB_PASSWORD` | required |
| `DB_NAME` / `DB_NAME_TEST` | `localaibudget` / `localaibudget_test` |
| `OLLAMA_HOST` / `OLLAMA_MODEL` | `http://127.0.0.1:11434` / `gemma4` |
| `OLLAMA_TIMEOUT_MS` | `180000` — per LLM call (AbortSignal.timeout). Timeout ≠ unavailable: a categorize batch is retried once, then its rows are left for review; insights return 504 |
| `STATEMENTS_DIR` | `<repo>/data/statements` (relative paths resolve against the repo root) |
| `PORT` | `3000` |

## Database & migrations

- Raw SQL with `pg` (no ORM). `DbService` = Pool + `query/one/tx` helpers. `date` columns are returned as `YYYY-MM-DD`
  strings (type parser 1082) and `numeric` as strings → converted with `num()` at the repository boundary.
- `db/migrations/NNN_name.sql`, applied in order by `npm run migrate` (`src/db/cli.ts` via ts-node), tracked in
  `schema_migrations`, each in its own transaction. Every migration is idempotent (re-running the SQL is safe).
  - `001_initial_schema.sql` — upgrades the hand-made legacy schema (merges duplicate accounts before adding UNIQUE,
    re-creates the splits FK with `ON DELETE CASCADE`, seeds categories incl. `Transfer` with `is_transfer`).
  - `002_rules_reconciliation_transfers_review.sql` — category_rules, reconciliation columns, transfer pairs, review flags.
- `npm run db:reset -- --yes` drops and recreates the `public` schema of `DB_NAME`, then migrates. Without `--yes` it refuses.

## Tests

```bash
npm test            # unit (jest, src/**/*.spec.ts) — no DB, no Ollama
npm run test:e2e    # e2e (supertest) against localaibudget_test
```

- Both scripts run jest with `node --experimental-vm-modules` — pdf-parse v2 / pdfjs-dist load their worker via dynamic
  `import()`, which jest only allows with that flag.
- Unit tests mock `LlmClient`. `src/parsing/fixtures.spec.ts` parses every file in `<repo>/fixtures/statements/` and compares
  with its `.expected.json` (rows as a multiset, balances, reconciliation status) with an LLM that throws if called.
- E2E: `test/global-setup.ts` creates `DB_NAME_TEST` if missing (via the `postgres` DB) and migrates it; `test/setup-env.ts`
  points `DB_NAME` at the test DB (refuses if equal to the dev DB) and `STATEMENTS_DIR` at a temp dir. Each suite calls
  `createTestApp()` (`test/utils.ts`) which truncates all tables, re-seeds by re-running migration 001, and overrides
  `LLM_CLIENT` with `FakeLlm` (keyword categorizer; `hold()` gates categorize calls to keep a job running; `unavailable`
  simulates Ollama down). `jobs.waitForIdle()` awaits background jobs. Suites run `--runInBand` (shared DB).

## Module map (`src/`)

| Module | What |
|---|---|
| `config/` | `.env` loading, typed `AppConfig` (`APP_CONFIG` token), repo paths |
| `db/` | `DbService`, migrator + CLI (`migrate`, `reset --yes`) |
| `llm/` | `LlmClient` interface + `LLM_CLIENT` token, `OllamaLlmClient` (`format:'json'`, `think:false`, temperature 0) |
| `health/` | `GET /health` (DB ping, Ollama `list()`, model present) |
| `statements/` | file naming (account/month from filename, format preference), discovery/sync, upload (multer, memory → `STATEMENTS_DIR/YYYY-MM/`), delete, `GET /months` |
| `parsing/` | `StatementParser` strategies: `ofx.parser`, `csv.parser` (csv-parse + header heuristics + LLM column-mapping fallback), `regex-line.parser`, `table-layout.parser` (running-balance bank table, two-date card table), `llm-extraction.parser` (page chunks ≤6k chars); `values.ts` (dates/amounts/period/balances), `sign-normalization.ts`, `reconciliation.ts` |
| `processing/` | `ProcessingService` (month pipeline), `dedupe.ts`, `transfers.ts` (pairing), `CategorizerService` (batches ≤20, few-shot, invalid → Other) |
| `jobs/` | in-process runner, `processing_jobs` progress, 409 via partial unique index, stale jobs failed on boot |
| `transactions/` | list/filter, PATCH correction / reviewed, PUT splits (`split-validation.ts`), bulk review |
| `rules/` | category rules CRUD, preview, suggest (`deriveMerchantKey`), apply to existing |
| `categories/`, `accounts/` | CRUD; `CategoryAccessService` = single choke point for future per-person category visibility |
| `budget/` | `budget-math.ts` (pure), summary + trend (splits-aware, by `transaction_date`) |
| `insights/` | Gemma summary + limit suggestions, validated and stored in `ai_insights` |

## Processing pipeline (POST /api/jobs/process)

1. Sync the month folder into `statement_files`; pick one file per basename (OFX/QFX > CSV > PDF > TXT).
2. Per file: extract text → first parser that returns rows → sign normalization (cards printed "charges positive" are negated
   when the majority of rows is positive) → insert with `dedupe_key` (`ON CONFLICT DO NOTHING`) → reconcile balances.
3. Categorize rows whose `statement_month` is the month **or** whose date is in the month, excluding manual corrections and
   split rows (`incremental`: only `category_id IS NULL`; `recategorize`: all of them): **rules → transfer pairing → Gemma**.

## Gotchas (learned the hard way)

- `@nestjs/config` **v12 is ESM-only** and breaks jest (`Must use import to load ES Module`). Use `@nestjs/config@^4`.
- pdf-parse v2: `new PDFParse({ data })`, `getText({ pageJoiner: '' })` (drops `-- 1 of 3 --` markers), always `destroy()`.
  It joins table cells with single spaces and drops empty cells, so withdrawal vs deposit columns are lost — the bank
  table parser derives the sign from the running-balance delta.
- Under `isolatedModules` + `emitDecoratorMetadata`, interfaces used in constructor parameter types must be imported with
  `import type` (e.g. `AppConfig`, `LlmClient`) or TS1272 errors appear.
- Nest sends an empty body for a `null` controller result — `GET /insights` uses `@Res()` to send literal `null`.
- Dates: never let pg parse `date` into JS `Date` (timezone shifts); the type parser keeps strings.
- Real Gemma takes ~30 s per 20-row categorization batch on this machine (a 150-row month ≈ 4 min). Keep batches at 20.
- The Bash tool on this machine mangles backslashes inside heredocs — write source files with an editor tool, not `cat <<EOF`.
