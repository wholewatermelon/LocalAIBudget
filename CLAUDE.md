# LocalAI Budget — Agent Guide

Local-first budgeting app: bank statements (PDF/TXT) → parsed → categorized by a local LLM (Ollama `gemma4`)
→ PostgreSQL → Angular dashboard. Nothing leaves the machine.

**Read first:** `docs/ARCHITECTURE.md` (API contract, schema, processing rules). It is the source of truth;
keep it in sync with any route/payload/table change. Progress tracking lives in `docs/ai_design.md`.

## Layout
- `server/` — NestJS API (port 3000). Raw SQL with `pg`, migrations in `server/db/migrations/`.
- `client/` — Angular app (port 4200), proxies `/api` → `127.0.0.1:3000` (server binds IPv4 loopback only).
- `data/statements/YYYY-MM/` — statement files (gitignored).
- `scripts/generate-fake-statements.js` — realistic synthetic statements, 2024-11..2025-01 (PDF/CSV/OFX/QFX/TXT; run from repo root; `--out <dir>`, `--fixtures`).
- `fixtures/statements/` — committed parser fixtures, one per layout, each with `<file>.expected.json`; see its README.md. `scripts/inspect-pdf.js <pdf>` prints what pdf-parse extracts.
- `scripts/legacy/` — original CLI prototype, reference only.

## Environment (this machine)
- Windows 11; shells: PowerShell 7 and Git Bash. Node 22, npm 10, Angular CLI 20.
- PostgreSQL 18 runs as Windows service `postgresql-x64-18`. `psql` is NOT on PATH:
  use `"/c/Program Files/PostgreSQL/18/bin/psql" -U postgres -d localaibudget` with `PGPASSWORD` from `.env`.
- Ollama at `http://127.0.0.1:11434`, model `gemma4` pulled. Calls are slow (seconds each) — always batch,
  and never hit real Ollama from unit tests.
- `.env` at repo root holds `DB_PASSWORD` (never print or commit it). See ARCHITECTURE.md for all vars.

## Commands
Root (`package.json`):
- `npm run dev` — server + client together
- `npm test` — server unit + e2e, then client unit tests
- `npm run generate:fake` — regenerate synthetic statements

Server (`cd server`): `npm run start:dev`, `npm run migrate`, `npm test` (unit), `npm run test:e2e`
(uses `localaibudget_test` DB, created + migrated automatically), `npm run db:reset` (wipes DEV data; fine to use — data is disposable).

Client (`cd client`): `npm start`, `npm test -- --watch=false`, `npm run build`.

## Conventions
- TypeScript strict. API JSON is camelCase; DB columns are snake_case — map in the repository layer.
- `numeric` columns come back from `pg` as strings: convert to numbers at the repository boundary.
- Money: negative = spending, positive = income.
- Manual corrections (`is_manual_correction = true`) and splits are never overwritten by AI.
- Ollama access only through the `LlmClient` abstraction so it can be mocked.
- Migrations are append-only, numbered `NNN_description.sql`, and must be idempotent.
- Tests: every service/endpoint change comes with tests. Unit tests mock `LlmClient` and filesystem where practical;
  e2e tests run against the real test DB with a fake `LlmClient`.

## Gotchas
- `pdf-parse` is v2 (class API): `new PDFParse({ data: buffer })` then `await parser.getText()` → `{ text }`.
  The v1 `pdf(buffer)` call style does not work.
- `data/statements/2025-01/` holds Maple Federal Checking as PDF, CSV and OFX with the same rows (exercises OFX > CSV > PDF preference).
- All DB data is disposable (synthetic). Resetting/wiping the dev DB is fine.
- Server: use `@nestjs/config@^4` (v12 is ESM-only and breaks jest). Jest runs with `node --experimental-vm-modules`
  (pdf-parse loads its worker via dynamic import). pdf-parse joins table cells with single spaces and drops empty ones →
  bank PDF signs come from the running-balance delta. Use `getText({ pageJoiner: '' })` and always `destroy()`.
- Server: category-scoped reads go through `CategoryAccessService` (future per-person visibility). Parser goldens:
  `server/src/parsing/fixtures.spec.ts` must stay green against `fixtures/statements/`. See `server/README.md` gotchas.
- Client: pages read category data only via `CategoryStore` (future per-person visibility filter hooks in there),
  never `CategoriesApi` directly. Selected month = `MonthService` (URL `?month=` is the source of truth).
- Client HTTP errors snackbar globally; pass `{ context: silent() }` when the caller shows its own message.
- Client tests: Karma ChromeHeadless (`npm test -- --watch=false`). In `fakeAsync`, `timer(0,…)` needs `tick(0)` and
  signals feeding `toObservable` need `fixture.detectChanges()` before `tick()`. Use `src/testing/` fixtures/stubs.
- Client icons are self-hosted (`material-symbols` npm) — no CDN; the app must work offline.
