# AI Design & Project Plan

## Project Goal
Automate the ingestion and categorization of financial statements using locally run AI (Gemma 4) to build a monthly budget.

## Database Schema
### Tables
- `categories`: Stores spending categories (e.g., Food, Rent) and their monthly budget limits.
- `accounts`: Stores financial accounts (Bank, Credit Card).
- `transactions`: Stores individual transactions, linked to an account and a category.
- `transaction_splits`: Allows a single transaction to be split across multiple categories.

## Decisions (2026-10-16)
- Stack: NestJS API + Angular UI + PostgreSQL + Ollama (gemma4). Full contract in `docs/ARCHITECTURE.md`.
- Ingestion: both UI upload and folder scan of `data/statements/YYYY-MM/`.
- Re-processing keeps manual corrections & splits; dedupe by (account, date, description, amount, occurrence).
- Parsing: regex first, Gemma JSON-extraction fallback, so real bank PDFs can be added later.
- Separate `localaibudget_test` DB for e2e tests.

## Implementation Plan

### Phase 1: Foundation (CLI prototype — now in `scripts/legacy/`)
- [x] PostgreSQL Schema Setup
- [x] Synthetic Data Generation (PDFs and TXT)
- [x] Basic Ingestion Logic (TXT parsing)
- [x] AI Categorization Pipeline (Ollama + Gemma 4)

### Phase 2: Backend API (`server/`)
- [ ] NestJS scaffold, config, DB module, migration runner + idempotent migration 001
- [ ] Statement discovery/upload, PDF extraction (pdf-parse v2), regex + LLM fallback parsers
- [ ] Dedupe + background processing jobs (incremental / recategorize)
- [ ] Transactions API with corrections + splits
- [ ] Categories/accounts API, budget summary + trend
- [ ] AI insights (summary + budget suggestions)
- [ ] Unit tests (mocked LLM) + e2e tests (test DB)

### Phase 3: Frontend (`client/`)
- [ ] Angular scaffold, Material, API services, month picker + health indicator
- [ ] Process page (upload, process/re-categorize, live job progress, history)
- [ ] Transactions page (filters, inline category correction, split dialog)
- [ ] Dashboard (totals, budget bars, insights w/ apply, trend)
- [ ] Categories page
- [ ] Component/service unit tests

### Phase 4: Integration
- [ ] End-to-end run against real Postgres + Ollama on synthetic data
- [ ] Code review pass, docs/README refresh

---

## Project Phase 2: Family Sharing & Per-Person Visibility (after the MVP above)
Goal: several people can view a month's budget, each seeing only the categories they're allowed to.
Example: adults see all categories; kids see only Restaurants, Entertainment, and their own personal budget.

- [ ] Users/people table + simple local login (household app, not internet-facing)
- [ ] Roles (e.g. `admin`/adult, `member`/kid) — admins manage everything
- [ ] Per-user category visibility (allow-list of category ids per user; admins see all)
- [ ] Personal categories owned by one person (e.g. "Alex's spending") with their own budget limit
- [ ] Every read endpoint (transactions, budget summary, trend, insights) filtered by the viewer's visible categories;
      totals computed only over visible categories so hidden spending can't be inferred
- [ ] Split portions visible per category (a kid sees only their split, not the whole transaction)
- [ ] UI: user switcher/login, admin screen to assign categories to people
- [ ] AI insights scoped per viewer (never mention hidden categories)

Design notes for MVP work: keep category access going through the categories/budget services (not ad-hoc SQL
in many places) so a visibility filter can be added in one spot later.
