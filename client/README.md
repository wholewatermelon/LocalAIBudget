# LocalAI Budget — client

Angular 20 (standalone components, signals, OnPush, zone.js) + Angular Material 3.
Built strictly against the API contract in [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Run / test / build

```bash
npm install
npm start                      # ng serve on :4200, proxies /api -> http://127.0.0.1:3000 (proxy.conf.json)
npm test -- --watch=false      # Karma + Jasmine in headless Chrome (non-interactive)
npm run build                  # production build -> dist/client
```

From the repo root: `npm --prefix client test -- --watch=false`, or `npm run dev` for server + client.

Tests run headless because `angular.json` → `test.options.browsers` is `ChromeHeadless` (reporter `dots`).
Chrome is installed on this machine. If only Edge is available, set
`CHROME_BIN="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"`.

## Folder structure

```
src/
  styles.scss                 Material 3 theme (light + dark via prefers-color-scheme), app tokens, badges
  app/
    app.ts / app.config.ts / app.routes.ts   Shell (toolbar, side nav), providers, lazy routes
    core/
      models.ts               Typed mirror of the REST contract (keep in sync with ARCHITECTURE.md)
      api/*.api.ts            One thin HttpClient service per area (+ *.spec.ts each)
      month.service.ts        Selected month signal <-> ?month= query param
      category.store.ts       THE single access point for category data (see "Categories" below)
      job-polling.ts          pollJob(): timer + exhaustMap + takeWhile(terminal)
      error.interceptor.ts    Global HTTP error -> snackbar (opt out per request with silent())
      http-context.ts         silent() HttpContext + errorMessage() for Nest error bodies
      notify.service.ts       Snackbar wrapper (info / error / action)
    layout/                   month-picker, health-indicator (polls /api/health every 30s)
    shared/confirm-dialog.ts
    features/
      dashboard/              page, totals cards, budget bars (+ budget-status.ts), insights panel, SVG trend chart
      process/                page, upload zone, statement list (+ reconciliation badge), job progress, job history
      transactions/           page (table, filters, review queue), split dialog, split-validation.ts
      categories/             page
      rules/                  page (list/edit/delete, create with live preview)
  testing/                    fixtures.ts, month-service.stub.ts (test-only; excluded from the app build)
```

## State approach

- **Signals everywhere** for component state; `computed()` for derived values; RxJS only for async flows
  (HTTP, debounce, polling) bridged with `toObservable` / `toSignal`.
- **Selected month** (`MonthService`): the URL `?month=YYYY-MM` is the source of truth. `select()` writes the URL;
  `NavigationEnd` updates the signal. With no/invalid param the default is the newest month from `GET /api/months`,
  else the current month (written back with `replaceUrl`). Nav links use `queryParamsHandling="preserve"`.
  Pages react with `effect(() => load(month()))`.
- **Categories** go through `CategoryStore` only (pages never call `CategoriesApi` directly). A future
  per-person visibility filter plugs into `CategoryStore.visibleFilter`.
- **Errors**: the interceptor snackbars every failed request. Requests whose caller shows a better message
  (optimistic rollback, 409s, inline dialog errors, background health polling, insight generation) pass
  `{ context: silent() }`.
- **Money** is formatted with the `currency` pipe (`DEFAULT_CURRENCY_CODE = 'USD'`). Split math is done in integer
  cents (`toCents`) so 0.1 + 0.2 sums correctly.

## How to add…

**An API call**: add types to `core/models.ts`, a method to the relevant `core/api/*.api.ts` (or a new
`@Injectable({ providedIn: 'root' })` file), and a spec using `setupHttp()` from `api.spec-helpers.ts` that asserts
URL, method, params and body with `HttpTestingController`. Decide whether errors should be `silent()`.

**A page**: create `features/<name>/<name>.page.ts` (standalone, `ChangeDetectionStrategy.OnPush`), add a lazy route in
`app.routes.ts` and a nav item in `app.ts`. Read the month from `inject(MonthService).selected`. Query params are bound
to `input()`s (router `withComponentInputBinding`). Add a `*.page.spec.ts` using `provideHttpClientTesting()` and
`monthServiceStub()` from `src/testing`.

## Gotchas

- `timer(0, …)` fires on the next macrotask — in `fakeAsync` tests call `tick(0)` before asserting the first poll.
- `toObservable()` only emits after effects run — call `fixture.detectChanges()` after setting a signal in tests,
  then `tick()` past any debounce.
- Material icons are self-hosted from the `material-symbols` npm package (no Google Fonts CDN — the app is
  local-first); `MAT_ICON_DEFAULT_OPTIONS.fontSet = 'material-symbols-outlined'`.
- Material 20 no longer needs `@angular/animations` / `provideAnimations`.
- `src/testing/**` and `*.spec-helpers.ts` use `jasmine` globals, so they are excluded in `tsconfig.app.json`.
- Uploading: files with a `YYYY-MM` in the name are sent **without** the `month` field (server puts them in that
  month); others are sent with the selected month.
- Headless Chrome screenshots with `--window-size` don't reflect the true mobile viewport; measure via CDP
  (`Emulation.setDeviceMetricsOverride`) if you need to check narrow layouts.

- The proxy targets `127.0.0.1`, not `localhost`: the server binds IPv4 loopback only and Node may resolve
  `localhost` to `::1`. Proxy changes need an `ng serve` restart.
- After anything that changes server-side counts (category PATCH, splits, review, rule applied, job finished) call
  `MonthService.refreshMonths()` (badges) and, if categories changed, `CategoryStore.load()` (transactionCount).
- The trend is anchored at the selected month (`?month=`). Its `byCategory` excludes uncategorized spend, so the chart
  adds an "Uncategorized" segment = `totalSpent − Σ byCategory`. Internal series keys (`__other__`,
  `__uncategorized__`) avoid clashing with real category names.
- Insight generation times out client-side after 300s; on timeout the panel re-GETs `/api/insights` once in case the
  server saved a result after the client gave up.
- Job progress is indeterminate while `queued` or while a running job reports `processed >= total`.

## Contract assumptions (see ARCHITECTURE.md)

- Budget bar color is computed client-side from `spent / budgetLimit` (green < 80 %, amber 80–100 %, red > 100 %);
  `percentUsed` (0–100, null without a limit) is not used for colour. No limit → neutral bar.
- Transfer categories are detected by the `isTransfer` flag (ARCHITECTURE F.2; name check only if the field is missing) and, like income, are shown under
  "Money in & transfers", never as a budget bar or in the spending trend.
- Optional fields from the MVP additions (`reconciliationStatus`, `needsReview`, `aiConfidence`, `transferPairId`,
  `rulesApplied`, `needsReviewCount`, …) are typed optional so older payloads still render.
