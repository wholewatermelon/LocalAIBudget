# LocalAI Budget

A local-first budgeting app. Drop in bank statements (PDF/TXT), and a locally running LLM (Ollama + Gemma 4)
extracts and categorizes the transactions. You review, correct, and split them in a web UI, track spending
against budgets, and get AI budget suggestions. Nothing leaves your machine.

- **Backend:** NestJS + PostgreSQL (`server/`)
- **Frontend:** Angular + Angular Material (`client/`)
- **AI:** Ollama running `gemma4`

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the API contract and processing rules, and
[`docs/ai_design.md`](docs/ai_design.md) for the roadmap.

## Prerequisites
- Node.js 22+ and npm
- PostgreSQL running locally, with a database named `localaibudget`
- Ollama with the model pulled: `ollama pull gemma4`

## Setup
1. Create `.env` in the repo root:
   ```env
   DB_PASSWORD=your_postgres_password
   # optional overrides: DB_HOST, DB_PORT, DB_USER, DB_NAME, OLLAMA_HOST, OLLAMA_MODEL, STATEMENTS_DIR, PORT
   ```
2. Install everything:
   ```bash
   npm run install:all
   ```
3. Create/upgrade the database schema:
   ```bash
   npm run migrate
   ```

## Run
```bash
npm run dev
```
Then open http://localhost:4200. The API runs at http://localhost:3000/api.

### Typical workflow
1. **Process** page: pick a month, upload statements (or drop them in `data/statements/YYYY-MM/`), and click
   **Process month**. Progress shows live.
2. **Transactions** page: fix any wrong categories (your corrections are kept and used to teach the AI),
   or split one transaction across categories.
3. **Categories** page: set monthly budget limits.
4. **Dashboard**: see spending vs. budget, then click **Generate insights** for an AI summary and suggested limits.

Re-processing a month is safe. Duplicates are skipped, and **Re-categorize** never overwrites your manual
corrections or splits.

### Sample data
```bash
npm run generate:fake   # creates synthetic statements for 2024-01..2024-03 in data/statements/
```

## Tests
```bash
npm test   # server unit + e2e (uses a separate localaibudget_test DB), then client unit tests
```

## Repo layout
| Path | |
|---|---|
| `server/` | NestJS API — see `server/README.md` |
| `client/` | Angular UI — see `client/README.md` |
| `docs/` | Architecture/API contract and roadmap |
| `scripts/` | Data generators; `scripts/legacy/` holds the original CLI prototype |
| `CLAUDE.md` | Guide for AI coding agents working in this repo |
