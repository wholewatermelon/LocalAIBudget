# Architecture & API Contract

This is the **source of truth** shared by the backend (`server/`) and frontend (`client/`).
If you change a route, payload, or table, update this file in the same change.

## Overview

```
 Browser (Angular, :4200)  ──/api proxy──▶  NestJS API (:3000)  ──▶  PostgreSQL (localaibudget)
                                                   │
                                                   ├──▶ Ollama (:11434, model gemma4)
                                                   └──▶ data/statements/YYYY-MM/*.pdf|*.txt
```

- Everything runs locally. No cloud calls.
- Long-running work (processing a month) runs as an **in-process background job**; the UI polls job status.
- Amount sign convention: **negative = money out (spending), positive = money in (income)**. "Spent" for a category = `-SUM(amount)` of its negative rows.

## Repo layout

| Path | What |
|---|---|
| `server/` | NestJS 11 API (TypeScript). Raw SQL via `pg` (no ORM). |
| `server/db/migrations/NNN_name.sql` | Ordered, idempotent SQL migrations. Applied by `npm run migrate`, tracked in `schema_migrations`. |
| `client/` | Angular 20 standalone app, Angular Material, signals. |
| `data/statements/YYYY-MM/` | Statement files (gitignored). Uploads land here too. |
| `scripts/generate-fake-statements.js` | Generates synthetic PDFs/TXTs for 2024-01..03 (run from repo root). |
| `scripts/legacy/` | The original CLI prototype. Reference only — do not extend. |

## Configuration (`.env` at repo root, loaded by the server)

| Var | Default | Notes |
|---|---|---|
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `5432` | |
| `DB_USER` | `postgres` | |
| `DB_PASSWORD` | — | required |
| `DB_NAME` | `localaibudget` | |
| `DB_NAME_TEST` | `localaibudget_test` | used by e2e tests; created/migrated automatically by test setup |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | |
| `OLLAMA_MODEL` | `gemma4` | |
| `OLLAMA_TIMEOUT_MS` | `180000` | per LLM call; timeout → batch retried once, then rows left for review (job continues); insights → 504 |
| `STATEMENTS_DIR` | `<repo>/data/statements` | |
| `PORT` | `3000` | |

## Database schema (target state after migrations)

Existing tables were created by hand before migrations existed, so migration `001` must be
**idempotent** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded constraint adds).

```sql
categories(
  id serial PK, name varchar(100) UNIQUE NOT NULL,
  budget_limit numeric(12,2) DEFAULT 0,
  is_ai_suggested boolean DEFAULT false,
  is_income boolean DEFAULT false            -- 'Income' seeded with true; excluded from spending
)
-- seed (ON CONFLICT DO NOTHING): Housing, Food, Restaurants, Transport, Entertainment, Utilities, Income(is_income), Shopping, Transfer, Other

accounts(
  id serial PK, account_name varchar(100) UNIQUE NOT NULL, account_type varchar(50) NOT NULL
)

statement_files(
  id serial PK, month char(7) NOT NULL,                 -- 'YYYY-MM'
  file_name text NOT NULL, file_type varchar(8) NOT NULL, -- 'pdf' | 'txt' | 'csv'
  account_id int REFERENCES accounts(id),
  size_bytes int, uploaded_at timestamptz DEFAULT now(),
  last_processed_at timestamptz, last_parse_method varchar(16), -- 'regex' | 'csv' | 'llm'
  UNIQUE(month, file_name)
)

transactions(
  id serial PK, account_id int REFERENCES accounts(id), category_id int REFERENCES categories(id),
  transaction_date date NOT NULL, description text NOT NULL, amount numeric(12,2) NOT NULL,
  is_manual_correction boolean DEFAULT false, raw_text text,
  statement_month char(7),                      -- NEW
  statement_file_id int REFERENCES statement_files(id) ON DELETE SET NULL,  -- NEW
  categorized_by varchar(16),                   -- NEW: 'ai' | 'manual' | null(uncategorized)
  dedupe_key text UNIQUE,                       -- NEW: see "Dedupe" below
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
)

transaction_splits(
  id serial PK, transaction_id int REFERENCES transactions(id) ON DELETE CASCADE,
  category_id int REFERENCES categories(id), amount numeric(12,2) NOT NULL
)

processing_jobs(
  id serial PK, type varchar(32) NOT NULL,      -- 'process_month'
  month char(7) NOT NULL, mode varchar(16) NOT NULL, -- 'incremental' | 'recategorize'
  status varchar(16) NOT NULL,                  -- 'queued' | 'running' | 'completed' | 'failed'
  total int DEFAULT 0, processed int DEFAULT 0,
  inserted int DEFAULT 0, skipped_duplicates int DEFAULT 0, categorized int DEFAULT 0,
  message text, errors jsonb DEFAULT '[]',
  started_at timestamptz, finished_at timestamptz, created_at timestamptz DEFAULT now()
)

ai_insights(
  id serial PK, month char(7) NOT NULL, summary text NOT NULL,
  suggestions jsonb NOT NULL DEFAULT '[]',      -- [{categoryId, categoryName, suggestedLimit, reason}]
  model varchar(64), created_at timestamptz DEFAULT now()
)
```

> The pre-migration dev DB contains ~28 rows that are duplicates (the legacy script had no dedupe)
> and all point at account 1. Dev data is disposable — wipe it freely (`npm run db:reset`).

## Processing rules

### File discovery
- A month = folder `STATEMENTS_DIR/YYYY-MM/`. Files there are registered in `statement_files` on scan/upload.
- Account derived from filename: `Main_Checking_2024-01.pdf` → strip `_YYYY-MM` + extension, `_`→space → `Main Checking`.
  Unknown accounts are auto-created with type `Credit Card` if the name contains "card", else `Bank`.
- If files share a basename, process in preference order **CSV > PDF > TXT** and ignore the rest (dedupe protects anyway).

### Parsing (pluggable `StatementParser` strategy)
Real inputs are bank (checking/savings) and credit card statements downloaded as **PDF or CSV**.
Realistic samples (several fictional bank layouts) live in `fixtures/statements/` with an
`expected.json` per file listing the exact transactions a correct parser must produce (already sign-normalized).
Parsers must pass against those fixtures.

**CSV** (`csv` parser — preferred whenever a CSV exists, it's exact):
1. Parse with a real CSV library (quoted fields, commas in descriptions, BOM, blank/preamble lines before the header).
2. Map columns by header name heuristics: date (`Date`, `Transaction Date`, `Trans. Date`, `Posted Date`, `Post Date` —
   prefer transaction date over post date), description (`Description`, `Payee`, `Merchant`, `Name`, `Memo` fallback),
   amount either a single `Amount` column or `Debit`/`Credit` (`Withdrawals`/`Deposits`) pair. Ignore `Balance`, `Category`, `Type`.
3. If headers can't be mapped → ask Gemma once with the header row + 3 sample rows to return the column mapping (JSON), then parse deterministically.
4. Dates: `YYYY-MM-DD`, `MM/DD/YYYY`, `M/D/YY`.

**PDF / TXT**:
1. Extract text (TXT: read file; PDF: `pdf-parse` v2 — `new PDFParse({ data: buffer }).getText()`).
2. **Regex line parser** for simple layouts: `^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})$`.
3. If regex finds 0 rows → **LLM extraction**: send text page-by-page (chunks ≤ ~6k chars) to Gemma (JSON format) with the
   statement period, asking for `[{date, description, amount, kind: 'debit'|'credit'}]`. Infer the year for `MM/DD` dates from
   the statement period (handle Dec→Jan periods). Validate every row; drop invalid/summary rows (balances, totals, interest-rate tables).

**Sign normalization** (all parsers): stored amounts are always negative = money out. Credit card statements and many card
CSVs list purchases as positive and payments as negative → negate for accounts of type `Credit Card` when the source convention
is "charges positive" (detect: majority of rows positive and the file/account is a card). Checking Debit/Credit columns: debit → negative.
Card payments (e.g. "PAYMENT THANK YOU") become positive amounts on the card account; they are transfers, not income —
categorize as `Transfer` (seed category, `is_income=false`, excluded from spending totals like income).

**Transaction month**: all month filtering (transactions list, budget summary, trend, month counts) uses `transaction_date`,
not the folder. A CSV may span several months; its rows land in their own months. `statement_month` records the folder the
file came from (used by "process month", which processes the files in that folder).

### Dedupe
`dedupe_key = sha256(account_id | date | normalized description | amount | occurrence)` where `occurrence`
is the 1-based count of identical (date, description, amount) rows within the same file. Insert with
`ON CONFLICT (dedupe_key) DO NOTHING` → counts as `skipped_duplicates`.

### Process modes (`POST /api/jobs/process`)
- `incremental` (default): import new rows; AI-categorize rows in the month where `category_id IS NULL`.
- `recategorize`: same, plus re-run AI on every row in the month where `is_manual_correction = false`
  and it has no splits. **Manual corrections and splits are never touched by AI.**

### AI categorization
- `LlmClient` interface wraps Ollama (`generate`/`chat` with `format: 'json'`, `think: false`). Tests mock it.
- Batch descriptions (≤ 20 per call). Allowed categories = names in `categories` table.
  Response not in allowed list → `Other`. Ollama unreachable → job `failed` with a clear message.
- Few-shot: include up to 20 most recent manual corrections (`description → category`) in the prompt
  so corrections teach the model.

## REST API (prefix `/api`, JSON, camelCase)

Errors: Nest default `{ statusCode, message, error }`. Validation via `class-validator` → 400.

### Health
- `GET /api/health` → `{ db: 'ok'|'error', ollama: 'ok'|'error', model: string, modelAvailable: boolean }`

### Months & statements
- `GET /api/months` → `MonthSummary[]` sorted desc:
  `{ month, fileCount, transactionCount, uncategorizedCount, lastProcessedAt: string|null }`
  (union of folders on disk and months present in `transactions`)
- `GET /api/statements?month=YYYY-MM` → `StatementFile[]`:
  `{ id, month, fileName, fileType, accountId, accountName, sizeBytes, uploadedAt, lastProcessedAt, lastParseMethod, transactionCount }`
- `POST /api/statements/upload` multipart: field `files` (1..n, `.pdf`/`.txt`/`.csv`, ≤ 20MB each), optional
  field `month`. Month = `month` field, else `YYYY-MM` found in filename, else 400. → `StatementFile[]`
- `DELETE /api/statements/:id` → removes file from disk + row; its transactions keep existing (`statement_file_id` set null). → 204

### Jobs
- `POST /api/jobs/process` body `{ month: 'YYYY-MM', mode?: 'incremental'|'recategorize' }` → `202 Job`.
  Only one running job per month (409 if one is queued/running for that month).
- `GET /api/jobs/:id` → `Job`
- `GET /api/jobs?month=&limit=20` → `Job[]` newest first
- `Job` = `{ id, type, month, mode, status, total, processed, inserted, skippedDuplicates, categorized, message, errors: {file?, line?, message}[], startedAt, finishedAt, createdAt }`
- On server start, any `queued`/`running` jobs are marked `failed` with message "Server restarted".

### Transactions
- `GET /api/transactions?month=&accountId=&categoryId=&uncategorized=true&search=` → `Transaction[]` (date desc)
  `Transaction` = `{ id, date, description, amount, accountId, accountName, categoryId, categoryName, categorizedBy, isManualCorrection, statementMonth, splits: {id, categoryId, categoryName, amount}[] }`
  (`amount` serialized as a JS number; `date` as `YYYY-MM-DD`)
- `PATCH /api/transactions/:id` body `{ categoryId: number|null }` → `Transaction`; sets `is_manual_correction=true`, `categorized_by='manual'`.
- `PUT /api/transactions/:id/splits` body `{ splits: {categoryId, amount}[] }` → `Transaction`.
  Each split amount must have the same sign as the transaction; sum must equal the transaction amount (to the cent) → else 400.
  Empty array clears splits. Setting splits sets `is_manual_correction=true`.

### Categories & accounts
- `GET /api/categories` → `{ id, name, budgetLimit, isIncome, isAiSuggested, transactionCount }[]`
- `POST /api/categories` `{ name, budgetLimit?, isIncome? }` → Category (409 on duplicate name)
- `PATCH /api/categories/:id` `{ name?, budgetLimit?, isIncome? }` → Category
- `DELETE /api/categories/:id` → 204; 409 if referenced by transactions/splits
- `GET /api/accounts` → `{ id, accountName, accountType }[]`; `PATCH /api/accounts/:id` `{ accountName?, accountType? }`

### Budget
- `GET /api/budget/summary?month=YYYY-MM` →
  ```
  { month, totalIncome, totalSpent, net,
    categories: { categoryId, name, budgetLimit, spent, remaining, percentUsed, isIncome }[],
    uncategorizedSpent }
  ```
  A transaction with splits contributes per split; otherwise via its `category_id`. Income categories
  report income in `spent` as a positive number and are listed last.
- `GET /api/budget/trend?months=6` → `{ month, totalIncome, totalSpent, byCategory: {[name]: number} }[]` oldest first

### AI insights
- `GET /api/insights?month=YYYY-MM` → latest `Insight | null`
- `POST /api/insights/generate` `{ month }` → `Insight` (synchronous; may take ~30–90s. Client shows spinner, 120s timeout).
  Sends up to 6 months of per-category totals + current limits to Gemma; asks for JSON
  `{ summary: string, suggestions: [{categoryName, suggestedLimit, reason}] }`. Unknown category names are dropped.
- `Insight` = `{ id, month, summary, suggestions: {categoryId, categoryName, suggestedLimit, reason}[], model, createdAt }`
- Applying a suggestion = client calls `PATCH /api/categories/:id { budgetLimit }`.

## Frontend pages (Angular)

Global header: app title, **month picker** (from `GET /api/months`, plus free-pick YYYY-MM), health dot (db/ollama).
Selected month lives in a shared signal service and is reflected in the URL query `?month=`.

1. **Dashboard** `/` — totals cards (income / spent / net), per-category budget progress bars
   (green < 80%, amber 80–100%, red > 100%), uncategorized warning linking to Transactions, AI insight panel
   (latest summary, "Generate insights" button, suggestions each with "Apply" → PATCH category), 6‑month trend.
2. **Process** `/process` — drag-and-drop upload, statement file list for the month (delete), buttons
   **Process month** (incremental) and **Re-categorize month** (confirm dialog explaining manual corrections are kept),
   live job progress (poll `GET /api/jobs/:id` every 1s while running), job history table with errors expandable.
3. **Transactions** `/transactions` — Material table, filters (account, category, uncategorized-only, search),
   inline category `mat-select` per row (PATCH), "Split" action opens dialog (rows of category+amount, live remaining
   balance, validation mirrors server), badges for `manual` / `ai` / split.
4. **Categories** `/categories` — editable table of name / budget limit / income flag; add & delete (show 409 nicely).

---

## MVP additions (approved 2026-10-16) — these extend/override the sections above

### A. OFX / QFX import
- Upload + discovery accept `.ofx` / `.qfx` (`file_type` `'ofx'|'qfx'`, `last_parse_method` `'ofx'`). Preference order for
  same-basename files: **OFX/QFX > CSV > PDF > TXT**.
- Support OFX 1.x (SGML, unclosed tags) and 2.x (XML). Read `<STMTTRN>` (`DTPOSTED`, `TRNAMT`, `NAME`/`MEMO`, `FITID`),
  `<LEDGERBAL>`, `<DTSTART>/<DTEND>`. `TRNAMT` sign is already "negative = money out" for both bank and card.
- Dedupe for OFX rows: `dedupe_key = sha256(account_id | 'fitid' | FITID)`.

### B. Category rules (learned from corrections)
```sql
category_rules(
  id serial PK, pattern text NOT NULL, match_type varchar(16) NOT NULL DEFAULT 'contains', -- 'contains'|'starts_with'|'regex'
  category_id int NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  priority int NOT NULL DEFAULT 0, hits int NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now(),
  UNIQUE(pattern, match_type)
)
```
- Matching is against the **normalized description** (uppercase, collapse whitespace). Highest priority, then longest pattern wins.
- Processing order for each non-manual, non-split row: **rules → transfer matching → Gemma**. `categorized_by` gains `'rule'` and `'transfer'`.
  In `recategorize` mode rules are re-applied too. Manual corrections still win over everything.
- `GET /api/rules` → `{ id, pattern, matchType, categoryId, categoryName, priority, hits }[]`
- `POST /api/rules` `{ pattern, matchType?, categoryId, priority?, applyToExisting?: boolean }` → Rule (+ `appliedCount` when applyToExisting)
- `PATCH /api/rules/:id`, `DELETE /api/rules/:id` → 204
- `POST /api/rules/preview` `{ pattern, matchType }` → `{ matchCount, sample: Transaction[] (≤10) }`
- `GET /api/rules/suggest?transactionId=` → `{ pattern, matchType, matchCount }` — merchant key derived by stripping
  prefixes (`POS DEBIT`, `SQ *`, `TST*`, `ACH`, dates), trailing store numbers / ref ids / city+state (e.g. `AMZN Mktp US*2K4L91` → `AMZN MKTP`).
- UX: after a category correction (PATCH), the client calls suggest and shows a snackbar
  "Always categorize **AMZN MKTP** as Shopping? (12 matching)" → creates rule with `applyToExisting: true`. A Rules page lists/edits rules.

### C. Statement reconciliation
- `statement_files` gains: `period_start date, period_end date, opening_balance numeric(12,2), closing_balance numeric(12,2),
  parsed_total numeric(12,2), reconciliation_status varchar(16) DEFAULT 'unknown'` (`'ok'|'mismatch'|'unknown'`), `reconciliation_diff numeric(12,2)`.
- Parsers return optional statement metadata (period, opening/closing balance). PDF: from the summary box (regex first, LLM fallback in the
  same extraction call). CSV with a Balance column: derive from first/last rows. OFX: `LEDGERBAL` + period.
- Check: **bank**: `opening + Σ amounts = closing`. **card** (balances are amounts owed): `opening_owed − Σ normalized amounts = closing_owed`.
  Tolerance 0.01. No balances found → `unknown`.
- `StatementFile` gains `periodStart, periodEnd, openingBalance, closingBalance, parsedTotal, reconciliationStatus, reconciliationDiff`.
- Job `errors` include a mismatch entry per file; `MonthSummary` gains `reconciliationIssues: number`.
- UI: badge per file on Process page (✓ / ⚠ "Off by $X — rows may be missing" / ?), dashboard warning when any file in month mismatches.

### D. Transfer matching across accounts
- `transactions.transfer_pair_id int REFERENCES transactions(id) ON DELETE SET NULL`.
- After import (and in recategorize), pair rows where: different accounts, `a.amount = -b.amount`, dates within 5 days, both unpaired,
  and at least one looks like a payment/transfer (description matches `PAYMENT|TRANSFER|XFER|AUTOPAY|ONLINE PMT|EPAY` or category Transfer).
  Prefer closest date. Paired rows → category `Transfer`, `categorized_by='transfer'` (unless manual).
- Card payments / transfer-looking rows left unpaired get `needs_review=true` (see E).
- `Transaction` gains `transferPairId` (+ `transferPairAccountName`). Job gains `transfersMatched`, `rulesApplied`.
- Budget summary/trend exclude `Transfer` from spending and income.

### E. Review queue (confidence)
- `transactions` gains `ai_confidence numeric(3,2)`, `needs_review boolean NOT NULL DEFAULT false`.
- Gemma categorization returns `{ category, confidence 0..1 }` per row. `needs_review = true` when confidence < 0.7, category fell back
  to `Other`, or unpaired transfer-looking row (D). Rule/manual/transfer-categorized rows → false.
- `GET /api/transactions?needsReview=true`; `Transaction` gains `aiConfidence, needsReview`.
- `PATCH /api/transactions/:id` also accepts `{ reviewed: true }` (clears flag without changing category); any category correction clears it.
- `POST /api/transactions/review` `{ ids: number[] }` → `{ updated }` (bulk "looks good").
- `MonthSummary` gains `needsReviewCount`. UI: "Needs review (N)" chip/filter on Transactions, count on dashboard, bulk approve.

### F. Contract clarifications (resolved after frontend build)
1. `percentUsed` is on a **0–100** scale (`spent / budgetLimit * 100`, rounded to 1 decimal); `budgetLimit = 0` → `null`.
2. Categories gain `is_transfer boolean DEFAULT false` (seed `Transfer` with true). `Category` and budget-summary category rows
   expose `isTransfer`. Transfer categories are excluded from spending, income, and trend; clients must use the flag, not the name.
3. Upload `month` field applies only to files whose names don't contain `YYYY-MM`; a month in the filename wins.
4. `PATCH /api/rules/:id` accepts a partial of `{ pattern, matchType, categoryId, priority }`.
5. `GET /api/transactions` with `uncategorized=true` ignores `categoryId`.

### G. Backend implementation notes (server agent, 2026-10-16) — additive, binding
1. **Budget math.** Totals: `totalIncome = Σ positive amounts`, `totalSpent = −Σ negative amounts`, `net = totalIncome − totalSpent`,
   all over non-transfer categories + uncategorized (refunds in a spending category therefore count as income).
   Category rows: spending `spent = −Σ negative`, income `spent = Σ positive`. Order: spending (spent desc), income, then
   transfer rows (`isTransfer: true`, `spent` = money moved out, informational only). `remaining = budgetLimit − spent`.
2. **Trend.** `GET /api/budget/trend?months=6[&month=YYYY-MM]` returns exactly `months` (1–24) calendar months ending at `month`
   (default: latest month that has transactions), oldest first, zero-filled. `byCategory` = spending categories with `spent > 0`.
3. **Process month scope.** Categorization covers rows with `statement_month = month` **or** `transaction_date` in the month.
4. **Parser chain** (first strategy that returns rows wins): OFX/QFX → CSV → legacy `YYYY-MM-DD` regex → running-balance bank table
   (sign from balance delta, seeded by "Beginning Balance") → two-date card table (Trans Date, Post Date) → Gemma page-by-page
   extraction. All fixtures in `fixtures/statements/` parse deterministically (no LLM).
5. **Account type from name:** `Credit Card` if the name contains card/visa/mastercard/amex/american express/discover, else `Bank`.
6. **Review flag nuance:** an unpaired transfer-looking row gets `needs_review` only when Gemma also labels it a transfer category
   (utilities like "… ONLINE PMT"/"… AUTOPAY" and "INTEREST PAYMENT" are not flagged just for the keyword).
7. **Few-shot examples** = up to 20 most recent manual corrections without splits (distinct descriptions).
8. **Additive response fields:** `StatementFile.accountType`; `Job.rulesApplied`, `Job.transfersMatched`.
9. **Status codes:** upload file > 20MB → 413; `POST /api/insights/generate` → 201, 503 if Ollama unreachable, 502 if the model's
   answer is unusable; `GET /api/insights` sends a literal JSON `null` when none. `POST /api/rules/preview` and
   `POST /api/transactions/review` → 200. `PATCH /api/transactions/:id` accepts `{ categoryId?: number|null, reviewed?: true }`
   (at least one; `categoryId: null` = manual "uncategorized").
10. **Migration 001 on the legacy DB** merges duplicate `accounts` rows (same name → lowest id, references re-pointed) before adding
    the UNIQUE constraint. Migration 002 holds the MVP additions (B–E).
11. **Server binds to 127.0.0.1 only.**
12. **Job progress units** = files + rows sent to Gemma. `total` starts as the file count with `processed = 0`; after import it
    becomes files + rows-to-categorize and `processed` jumps to the file count, so `processed/total` is monotonic and ≤ 1.
13. **LLM failures:** connection refused / model missing → job `failed` (insights 503). Timeout (`OLLAMA_TIMEOUT_MS`) → the
    categorize batch is retried once; on a second timeout its rows stay as they were (uncategorized in incremental mode) with
    `needs_review = true` and a job error is recorded; the job still completes. Insights timeout → 504.
14. **Rules `applyToExisting`** only touches rows where the new rule is the winning rule (priority, then longest pattern) and
    skips manual, split and transfer-paired rows.
