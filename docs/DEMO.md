# 5-minute demo — LocalAI Budget

Audience: technical. Story: *real-looking bank statements in, a credible budget out — and nothing leaves the laptop.*
Everything below is reproducible: `npm run demo:reset` restores the exact staged state in seconds, offline.

## Pre-demo checklist (T-10 min)

1. `npm run dev` is running (API http://127.0.0.1:3000/api, UI http://localhost:4200). Don't restart it during the demo.
2. **Turn Wi-Fi off** (and unplug Ethernet) *before* the reset, so the warm-up and everything after it happen offline —
   no npm installs, CDNs or fonts are fetched (icons are self-hosted; the scripts only talk to 127.0.0.1: API, Ollama, Postgres).
3. `npm run demo:reset` — regenerates the statement files, restores `demo/snapshot.sql`, warms Gemma (model stays loaded
   60 min via `OLLAMA_KEEP_ALIVE`) and prints a checklist. Every line must be `[x]`. Takes ~1 s + warm-up ~1 s (up to ~30 s if the model was unloaded).
4. Browser: one window, only these tabs: `http://localhost:4200/?month=2025-01` (reload it after the reset), plus a
   terminal and an editor with `docs/ARCHITECTURE.md`, `fixtures/statements/Summit_Rewards_Visa_2024-12.pdf.expected.json` open.
   Zoom 125 %, dark/light as you like, notifications muted, the browser's download bar closed.
5. File Explorer open at `demo/upload/` (for drag & drop of `Summit_Rewards_Visa_2025-02.pdf`).
6. Ollama tray icon running. Health dot in the app header is green.

## Talk track

| Time | Screen | Click / action | Say |
|---|---|---|---|
| 0:00 | Dashboard, month **2025-01** | — | "This is a budgeting app that reads real bank and card statements — PDF, CSV, OFX — and categorizes them with a local LLM, Gemma 4 in Ollama. Wi-Fi is off — and the health dot top-right is still green: it only checks Postgres and the local model. Nothing here needs the internet." |
| 0:20 | Dashboard | Point at totals, budget bars, 6-month trend, insight panel | "Six months of history from four accounts at three (fictional) banks: checking, savings, two credit cards. Income $11,094.97, spent $12,239.09 in January." |
| 0:40 | Transactions | Nav **Transactions** → chip **Needs review (4)** | "Gemma returns a category *and a confidence*. Low-confidence rows, `Other` fallbacks and unmatched transfers land in a review queue instead of silently polluting the budget." |
| 0:55 | Transactions | Row **Jan 10, 2025 `SQ *BLUE BOTTLE COFFEE OAKLAND CA` −$10.75** → category select **Food → Restaurants** | "Gemma filed this coffee shop under Food. I correct it once…" |
| 1:05 | Snackbar (stays open until you choose) | "Always categorize **BLUE BOTTLE COFFEE** as Restaurants? (19 matching)" → **Create rule** → "Rule created — 19 transactions updated" | "…and the app derives a merchant key — it strips `SQ *`, store numbers, city and state — and offers a rule. The other 19 Blue Bottle rows across all months update now, and every future import hits the rule before the LLM. Corrections are also fed back to Gemma as few-shot examples." |
| 1:25 | Rules | Nav **Rules** (optional, 5 s) | "Rules are plain data: pattern, match type, priority, hit counts." |
| 1:35 | Process, month **2025-02** | Month picker → **2025-02**; nav **Process** | "February: the checking statement is already imported. The card statement just arrived." |
| 1:45 | Process | Drag `demo/upload/Summit_Rewards_Visa_2025-02.pdf` onto the upload zone → **Process month** | "A PDF straight from the card issuer's website. Parsing is deterministic first: OFX, CSV, a running-balance bank-table parser, a two-date card-table parser — the LLM is only the fallback for layouts nothing else understands." |
| 1:55 | Process (job running, ~6–10 s) | Watch the progress bar; when done, read the highlighted summary "13 new rows — 8 by rules, 1 transfer pair, 4 by Gemma" | "13 rows: 8 hit rules — including the coffee rule I created a minute ago — the card payment is matched as a transfer, and only 4 new merchants go to Gemma: Little Stars Dance Academy, Spotify, Pine State Biscuits, REI." |
| 2:20 | Process | Statement list: **✓** badge on the Summit file; job history row (inserted / rules / transfers / categorized) | "Reconciliation: previous balance minus the parsed rows must equal the new balance printed on the statement, to the cent. If a row were dropped we'd know." |
| 2:30 | Process | **Process month** again | "Re-processing is idempotent: every row has a dedupe key, so this run inserts 0 and skips 58 duplicates." |
| 2:40 | Transactions, 2025-02 | Nav **Transactions**; row `PAYMENT THANK YOU - WEB` +4,044.72 | "This payment on the card and `ONLINE PMT SUMMIT VISA` −4,044.72 in checking, processed earlier, were paired across accounts — categorized Transfer, so paying your card isn't counted as spending twice." |
| 2:55 | Dashboard, **2024-10** | Month picker → **2024-10** | "And when the numbers *don't* add up: October's checking statement says its ending balance is $42.17 higher than the rows we parsed. Dashboard warning "1 statement file doesn't reconcile with the statement balances — rows may be missing" → click it → ⚠ *Off by $42.17* on the Process page." |
| 3:10 | Budget → **This month**, **2024-12** | Month **2024-12**, nav **Budget** | "Budgets are versioned. December has a one-off *Holiday Gifts* line and an adjusted Food amount with a note — past months keep the budget they had." |
| 3:30 | Budget → **Main budget**, month **2025-02** | Month **2025-02**, tab **Main budget** → **Create from a month…** → From **2025-01**, Use **Average spending**, Months **3**, Round up to **$25**, Start month **2025-02** → **Preview** → **Replace main budget** | "Or bootstrap the budget from what you actually spend: three-month average, rounded up, shown as a diff against the current budget, applied from February on." (Note: the proposal includes Holiday Gifts $150 because December's one-off spending is in the 3-month average — say "I'd drop that one", or just confirm.) |
| 4:00 | Dashboard, **2025-01** | Month **2025-01**, insight panel | "Insights: Gemma gets six months of per-category totals and the budgets and suggests limits with a reason — generated locally in about 45 s, so this one was made earlier. Apply is per month or to the main budget from this month on." (Don't apply the Holiday Gifts $0 suggestion.) |
| 4:15 | Editor / terminal | Under the hood (below) | "How it was built…" |
| 4:55 | — | — | "Local model, deterministic parsers first, reconciliation, idempotent imports, rules learned from corrections, transfer pairing, versioned budgets. Questions?" |

### Exact demo values (from the current snapshot)

| What | Value |
|---|---|
| Review queue 2025-01 | `SQ *BLUE BOTTLE COFFEE OAKLAND CA` (Food), `VENMO CASHOUT PPD ID: 5264681992` (Income), `MOBILE DEPOSIT REF NUMBER :418820557731` (Income), `CHECK #1046` (Other) |
| Row to correct | Jan 10, 2025 `SQ *BLUE BOTTLE COFFEE OAKLAND CA` −$10.75, Summit Rewards Visa, Gemma: Food |
| Rule offered | `BLUE BOTTLE COFFEE` (contains) → Restaurants, 19 matching (after the correction), 19 updated |
| Live upload | `demo/upload/Summit_Rewards_Visa_2025-02.pdf`: 13 rows (Previous Balance $4,044.72, New Balance $632.13) |
| Payment pair | Checking 2025-02-20 `ONLINE PMT SUMMIT VISA …` −4,044.72 ↔ Summit 2025-02-21 `PAYMENT THANK YOU - WEB` +4,044.72 |
| Mismatch | `Maple_Federal_Checking_2024-10.pdf`: stated ending $6,542.82, parsed $6,500.65 (diff 42.17) |
| December budget | Holiday Gifts $500 (this month only, "Gifts for family and teachers"); Food $4,200 adjusted ("Hosting the family for the holidays") vs main $3,800 |
| Pre-staged rules | AMZN MKTP→Shopping, SHELL OIL→Transport, PAYROLL→Income, DIR DEP→Income, PINECREST HOME LOANS→Housing, CASCADE POWER & LIGHT→Utilities, NETFLIX→Entertainment, COSTCO WHSE→Food |
| Split | 2025-01-27 `COSTCO WHSE #0681 WOOD VILLAGE OR` −211.12 (Summit) → Food −137.23 / Shopping −73.89 |

## Under the hood (40 s — pick 3)

1. **`docs/ARCHITECTURE.md`** — the overview diagram and the API contract. "Backend and frontend were built by separate
   agents in parallel against this single contract; changes to a route or table must update this file."
2. **A fixture and its expected output** — `fixtures/statements/Summit_Rewards_Visa_2024-12.pdf` (run
   `node scripts/inspect-pdf.js fixtures/statements/Summit_Rewards_Visa_2024-12.pdf`) next to its `.expected.json`.
   "Every layout quirk — wrapped rows, MM/DD dates across a year boundary, APR tables that must not be parsed, a statement
   whose totals deliberately don't reconcile — has a golden file. The parser tests run them with an LLM that throws if called."
3. **`npm --prefix server test`** — 109 unit tests in ~4 s, no DB and no Ollama (the LLM is behind an interface and mocked);
   e2e tests run against a separate Postgres DB with a fake LLM.

## Fallbacks

| Problem | Do this |
|---|---|
| Gemma slow / live job > 60 s | Keep talking over the progress bar ("this is a local model on a laptop, no GPU cloud"). If it stalls, switch to month **2025-01** → Process → job history: show a finished job's counters (rules / transfers / Gemma) and the ✓ badges, then continue with Budget. |
| Gemma unreachable (red dot) | `ollama serve` / start the Ollama tray app, then `npm run demo:reset` (warm-up). Without Gemma the live job fails cleanly with a message — show that, it's a feature. |
| Snackbar "Always categorize…" dismissed by mistake | Rules page → form: Description pattern `BLUE BOTTLE COFFEE`, Match contains, Category Restaurants, tick **Apply to existing transactions** → **Create rule**. Or change another Blue Bottle row's category to get the prompt again. |
| Wrong month after a click | Month picker; the month is in the URL (`?month=`), so the back button works too. |
| Upload rejected / file missing | `npm run demo:reset` recreates `demo/upload/Summit_Rewards_Visa_2025-02.pdf`. |
| Reconciliation story | Process page, month **2024-10**: the ⚠ badge shows "Off by $42.17 — rows may be missing". |
| Anything weird | `npm run demo:reset` (seconds), reload the tab, jump to the step you were on. |

## How the demo state is built

- `npm run demo:reset` (`scripts/demo-reset.js`): regenerates `data/statements/` with
  `generate-fake-statements.js --demo` (deterministic — identical bytes to what the snapshot was built from; wipes any
  uploaded file), restores `demo/snapshot.sql` (drop + recreate the `public` schema, one psql transaction — safe while the
  dev server runs: it holds no cached state, and the script waits for any running job), warms Gemma, checks `/api/health`.
- `npm run demo:prepare` (`scripts/demo-prepare.js`, ~18–22 min with real Gemma): `db:reset` → generate → 8 rules →
  process 2024-08..2025-02 through the API (real Gemma; retries a month whose job failed with "Server restarted") → staging →
  insight for 2025-01 (real Gemma, generated *before* the budgets so it reasons from spending rather than echoing them) →
  budgets → `pg_dump` to `demo/snapshot.sql`. Resume with `--from <phase>`.
  Staging is honest-but-curated: obvious Gemma slips are corrected in SQL (rows stay `categorized_by = 'ai'`; Blue Bottle is
  pinned to Food so the correction story works), the review queue is reduced to 4 hand-picked January rows, plus 5 manual
  corrections and 1 split via the API, and the budgets above.
- `node scripts/demo-rehearse.js` runs steps 2–4 through the API with timings (then `demo:reset` again).
- Data is synthetic: fictional household, banks and account numbers; merchant strings imitate real statement text.
