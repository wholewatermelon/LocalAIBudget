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
