# Statement parser fixtures

Small, committed, realistic statements — one per layout the app must handle — each with a sibling
`<file>.expected.json` describing exactly what a correct parser must produce. Parser tests must pass against all of them.

Everything here is **fictional** (household "Jordan & Casey Rivera", Maple Federal Bank, Summit Card Services,
Harbor Bank, Tidewater Online Savings, all account/routing numbers). Merchant strings imitate real statement text.

Regenerate (deterministic; identical output every run):

```bash
npm run generate:fixtures          # = node scripts/generate-fake-statements.js --fixtures [--out <dir>]
node scripts/inspect-pdf.js fixtures/statements/Summit_Rewards_Visa_2024-12.pdf   # print pdf-parse output
```

The fixtures are row subsets of the same ledger that `npm run generate:fake` writes (full months, 40–70 rows each) to
`data/statements/YYYY-MM/`. Balances in each fixture are recomputed from its subset, so every fixture is self-consistent.

## Expected-file schema

```jsonc
{
  "account": "Summit Rewards Visa",       // = name derived from the filename (ARCHITECTURE.md "File discovery")
  "accountType": "Credit Card",           // "Bank" | "Credit Card"
  "periodStart": "2024-12-05",            // statement period / export date range (YYYY-MM-DD)
  "periodEnd": "2025-01-04",
  "openingBalance": 5528.28,              // only when the source states it (or derives it, e.g. CSV Balance column)
  "closingBalance": 4924.65,              //   bank: account balance; card: amount OWED, positive
  "expectReconciliation": "ok",           // "ok" | "mismatch" | "unknown" (unknown = opening and/or closing not available)
  "reconciliationNote": "...",            // optional, human explanation (broken fixture only)
  "transactions": [
    { "date": "2024-12-23", "description": "PAYMENT THANK YOU - WEB", "amount": 1850.00 }
  ]
}
```

- `amount` is already **sign-normalized** to the app convention: negative = money out of *that* account.
  Card purchases/fees/interest are negative, card payments and refunds positive.
- `description` is the full merchant text on one line; PDF rows that wrap onto a second line are joined with a single space.
- `transactions` are sorted by date ascending (stable). Source order differs (CSVs are newest-first), so **compare as a
  multiset** — e.g. sort both sides by `(date, description, amount)`.
- Reconciliation (ARCHITECTURE.md "MVP additions" C): bank `opening + Σ amounts = closing`; card
  `opening_owed − Σ amounts = closing_owed`; tolerance 0.01.

## Files

| File | Layout | Rows | Balances | Recon |
|---|---|---|---|---|
| `Maple_Federal_Checking_2024-12.pdf` | bank PDF, running balance | 18 | opening/closing | ok |
| `Maple_Federal_Checking_2024-11.pdf` | same layout, **deliberately broken** summary | 10 | opening/closing (stated) | **mismatch** |
| `Maple_Federal_Checking_2025-01.csv` | bank CSV Debit/Credit/Balance | 12 | derived from Balance column | ok |
| `Maple_Federal_Checking_2025-01.ofx` | OFX 2.2 XML (bank) | 12 (same rows as the CSV) | closing (`LEDGERBAL`) | unknown |
| `Summit_Rewards_Visa_2024-12.pdf` | credit-card PDF, cycle crosses the year | 16 | previous/new balance (owed) | ok |
| `Harbor_Cash_Back_Card_2024-12.csv` | card CSV, single signed Amount | 12 | none | unknown |
| `Harbor_Cash_Back_Card_2024-11.qfx` | OFX 1.02 SGML / QFX (card) | 10 | closing (`LEDGERBAL`, negative in file) | unknown |
| `Maple_Federal_Savings_2024-12.txt` | legacy `YYYY-MM-DD desc amount` | 3 | none | unknown |

### `Maple_Federal_Checking_2024-12.pdf` — bank statement PDF
- Header with bank name/address/customer address; "December 1, 2024 through December 31, 2024"; account number.
- **Account Summary box**: Beginning Balance, Deposits and Additions (count, total), Withdrawals and Subtractions
  (count, `-total`), Ending Balance. Also an APY / "Interest Paid Year-to-Date" block — not transactions.
- Transaction table: `MM/DD` dates **without year** (take it from the period), description, separate WITHDRAWALS and
  DEPOSITS columns, running BALANCE.
- First row `Beginning Balance 8,999.58` and last row `Ending Balance ...` have no date and are **not** transactions.
- Long descriptions **wrap onto a second line** with no date/amounts (`...PPD ID:` / `4417730021`).
- Descriptions themselves contain dates and numbers (`POS DEBIT 11/30 CHEVRON 0098812 ...` posted 12/02;
  `DEBIT CARD PURCHASE 12/01 ...`) — the row date is the first column (posting date), not the one inside the text.
- 3 pages: page header + column header repeated on every page, footer `... Page 1 of 3`.
- **DAILY ENDING BALANCE** section after the table (`12/01 $8,953.67 12/02 $6,419.25 ...`) — looks like dated amounts,
  must NOT be parsed. Then legal fine print.
- Thousands separators (`2,385.00`), amounts never carry a sign in the table.

### `Maple_Federal_Checking_2024-11.pdf` — reconciliation failure
Same layout, but the summary box and the final "Ending Balance" line state **$4,254.47**, while
opening 4,812.37 + Σ rows = **4,212.30** (stated closing is $42.17 too high, as if a row were missing).
Per-row running balances and the daily balance section are internally correct. The parser should still return all
10 rows; reconciliation must come out `mismatch` (diff 42.17).

### `Maple_Federal_Checking_2025-01.csv` — bank CSV
- 2-line preamble (`Maple Federal Bank - Account Activity Export`, `Account: ... Date Range: ...`) and a blank line
  before the header `Date,Description,Debit,Credit,Balance`.
- Dates `MM/DD/YYYY`; **newest first**; Debit and Credit are both positive numbers in separate columns (debit → negative).
- No thousands separators. `Balance` is the balance after the row: opening = oldest row's balance − its amount,
  closing = newest row's balance.
- Descriptions with `'`, `&`, `#`, `:`, `*` (no commas here, so unquoted).

### `Maple_Federal_Checking_2025-01.ofx` — OFX 2.x XML
- `<?xml ...?>` + `<?OFX OFXHEADER="200" VERSION="220" ...?>`, properly closed tags, indented.
- `DTPOSTED` like `20250102120000.000[-8:PST]`; `TRNAMT` already signed (negative = out); unique `FITID`s
  (`MFB2025010200019121`); `TRNTYPE` DEBIT/CREDIT/CHECK/ATM/XFER/INT, `CHECKNUM` on the check.
- **`NAME` is truncated to 32 chars** (OFX limit); when truncated, `MEMO` carries the full text. Expected
  description = `MEMO` when it starts with `NAME`, else `NAME` (+ ` ` + `MEMO` if present and different) — here it is
  always the full text. `&` is escaped as `&amp;`.
- Only `LEDGERBAL` (closing 6,535.40) — no opening balance, so expected reconciliation is `unknown` (opening could be
  derived as closing − Σ, but that is tautological).
- **Same basename as the CSV** with the same rows: if both are scanned together only the OFX must be processed
  (preference OFX/QFX > CSV > PDF > TXT). `data/statements/2025-01/` additionally has the PDF of the full month.

### `Summit_Rewards_Visa_2024-12.pdf` — credit-card statement PDF
- `Opening/Closing Date 12/05/24 - 01/04/25`: rows dated 12/xx are **2024**, 01/xx are **2025**. Some purchases have a
  Trans Date before the cycle start (`12/03 12/05 ...`) — still 2024, still in this statement.
- Two side-by-side boxes on page 1: PAYMENT INFORMATION (New Balance, Minimum Payment Due, Payment Due Date, late-fee
  warning) and ACCOUNT SUMMARY (Previous Balance, Payment/Credits, Purchases, Cash Advances, Balance Transfers, Fees,
  Interest, New Balance, Credit Limit, Available Credit). Extraction prints the left box first, then the right one.
- `Trans Date` and `Post Date` columns (`MM/DD`); **expected `date` = Trans Date**.
- Sections `PAYMENTS AND OTHER CREDITS`, `PURCHASES`, `FEES CHARGED`, `INTEREST CHARGED`; statement convention is
  purchases **positive**, payments/credits **negative** (`-1,850.00`) → negate everything for the expected output.
- `TOTAL FEES FOR THIS PERIOD $5.59` / `TOTAL INTEREST FOR THIS PERIOD $140.96` — totals, not rows.
- One wrapped row: `ALASKA AIR 0277142903318 SEATTLE WA` / `PASSENGER: RIVERA/JORDAN M`.
- A foreign purchase followed by `FOREIGN TRANSACTION FEE`; an Amazon `RETURN` credit; `PURCHASE INTEREST CHARGE`
  dated the closing date.
- Not transactions: `2025 Totals Year-to-Date` block and the **INTEREST CHARGE CALCULATION** (APR) table
  (`PURCHASES 22.99%(v)(d) $7,219.17 $140.96`).
- 2 pages with repeated header and `ACCOUNT ACTIVITY (CONTINUED)`.
- Balances: Previous Balance 5,528.28 (opening owed), New Balance 4,924.65 (closing owed).

### `Harbor_Cash_Back_Card_2024-12.csv` — card CSV
- **UTF-8 BOM**, **CRLF** line endings, newest first.
- Header `Transaction Date,Post Date,Description,Category,Type,Amount` — use Transaction Date; ignore Category/Type.
- Amount already signed the app's way (purchases negative, `Payment`/`Return` positive) — do **not** negate even though
  the account is a card (the "majority positive" sign heuristic must not flip it).
- Quoted descriptions containing commas: `"SQ *SMITH & SONS, LLC PORTLAND OR"`, `"LYFT *RIDE FRI 6PM, SAN FRANCISCO CA"`.
- Payment rows have an empty Category.

### `Harbor_Cash_Back_Card_2024-11.qfx` — OFX 1.x SGML (Quicken QFX)
- Plain `KEY:VALUE` header block (`OFXHEADER:100`, `DATA:OFXSGML`, `VERSION:102`, `CHARSET:1252`, ...), blank line, then
  SGML with **unclosed leaf tags** (`<TRNAMT>-37.71`), CRLF, `<INTU.BID>`.
- `CREDITCARDMSGSRSV1/CCSTMTRS` (not `BANKMSGSRSV1`). `TRNAMT` already signed (purchase negative, payment positive).
- Expected `date` = `DTPOSTED` (the post date — this format has no transaction date).
- `NAME` truncated to 32 chars and there is **no MEMO**: expected descriptions are the truncated text
  (`UBER *EATS PENDING HELP.UBER.COM`, `LYFT *RIDE SUN 11PM, SAN FRANCIS`). `&` appears as `&amp;`.
- `LEDGERBAL/BALAMT` is **negative** (`-419.64` = $419.64 owed) → `closingBalance: 419.64`.

### `Maple_Federal_Savings_2024-12.txt` — legacy text
`2024-12-06 ONLINE TRANSFER FROM MAPLE FEDERAL CHECKING XXXXXX2290 500.00` — the regex path
`^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})$`. Note a trailing word (`HOLIDAY`) before the amount.

## Transfer matching (December set)

Process all December fixtures together (checking PDF 2024-12, Summit PDF 2024-12, Harbor CSV 2024-12, savings TXT)
to test ARCHITECTURE.md "MVP additions" D:

| Checking row | Counterpart | Gap | Expected |
|---|---|---|---|
| 12/20 `ONLINE PMT SUMMIT VISA ...` −1,850.00 | Summit 12/23 `PAYMENT THANK YOU - WEB` +1,850.00 | 3 days | pair |
| 12/24 `HARBOR CARD AUTOPAY ...` −2,662.55 | Harbor 12/23 `AUTOMATIC PAYMENT - THANK YOU` +2,662.55 | 1 day | pair |
| 12/05 `ONLINE TRANSFER TO MAPLE FEDERAL SAVINGS` −500.00 | Savings 12/06 `ONLINE TRANSFER FROM ... CHECKING` +500.00 | 1 day | pair |
| 12/18 `ONLINE TRANSFER FROM MAPLE FEDERAL SAVINGS` +300.00 | Savings 12/18 `... TO MAPLE FEDERAL CHECKING ... HOLIDAY` −300.00 | 0 days | pair |
| 12/27 `ONLINE TRANSFER TO TIDEWATER ONLINE SAVINGS` −250.00 | none (no statement for that bank) | — | **stays unpaired** (→ needs review) |

Heuristic traps (transfer-looking text but not transfers, never paired because no opposite amount exists):
`ACH DEBIT CASCADE POWER & LIGHT ONLINE PMT ...` (utility; contains `ONLINE PMT`), `INTEREST PAYMENT` (contains
`PAYMENT`), and in the full data `RIVERNET BROADBAND AUTOPAY`, `VELOCITY WIRELESS AUTOPAY`. A naive
"unpaired transfer-looking → needs_review" rule will flag these too.

Other fixtures also contain card payments whose counterparts are not in the fixture set (Jan checking → Summit,
Harbor Nov payment) — they are paired only in the full `data/statements/` set, where every card payment has an exact
opposite-amount counterpart 1–3 days apart (checking pays Summit on the 20th → card posts next business day;
Harbor auto-pays on the 23rd → checking is debited next business day). Checking → Maple savings transfers in November
and January have no counterpart either (only the December savings TXT exists).

## Full sample set (`npm run generate:fake` → `data/statements/`)

| Month | Files |
|---|---|
| 2024-11 | Checking `.pdf`, Summit `.pdf` (11/05–12/04), Harbor `.qfx` |
| 2024-12 | Checking `.pdf`, Summit `.pdf` (12/05–01/04), Harbor `.csv`, Savings `.txt` |
| 2025-01 | Checking `.pdf` + `.csv` + `.ofx` (same rows, same basename → OFX wins), Summit `.pdf` (01/05–02/04, contains Feb dates), Harbor `.csv` |

Balances chain across months (checking Nov closing = Dec opening; Summit New Balance = next Previous Balance; each
Harbor autopay = previous month's balance).

## pdf-parse (v2) notes for parser authors

- API: `const { PDFParse } = require('pdf-parse'); const p = new PDFParse({ data: buffer }); const { text, pages, total } = await p.getText(); await p.destroy();`
  (`pages[i].text` per page; `getText({ partial: [2] })`, `{ first: N }` select pages).
- Text comes out **row by row** in visual order for these PDFs (each row drawn at one baseline).
- **Column cells are joined by a single space** — not `\t`, even though `cellSeparator` defaults to `\t` (passing
  `cellSeparator`/`cellThreshold` did not change it for these files). Columns are therefore not recoverable from the
  text: a checking row `12/02 ACH DEBIT ... PPD ID: 2,385.00 6,568.67` doesn't say whether 2,385.00 was a withdrawal
  or a deposit. Use the running balance (`balance − previous balance`) or the "Beginning Balance" seed to determine the
  sign; empty cells simply vanish.
- Wrapped description continuation lines appear as their own line right after the row (no date, no amount).
- Each page ends with a separator line `-- 1 of 3 --` (pdf-parse's default `pageJoiner`), after our own footer
  `... Page 1 of 3`. Both must be ignored. Pass `pageJoiner: ''` to drop the former.
- Side-by-side boxes (Summit page 1) are emitted left box first, then right box, not interleaved.
- `$`, `-$`, `+$` prefixes and thousands separators appear in summaries; table amounts have separators but no `$`.
