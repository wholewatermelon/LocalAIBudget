import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { shortMonth } from '../../core/month-utils';
import { TrendPoint } from '../../core/models';

/** Max named series; the rest fold into "Other" (palette has 8 validated slots). */
const MAX_SERIES = 7;
const W = 640;
const H = 240;
const PAD = { top: 12, right: 12, bottom: 28, left: 56 };

/** Internal series keys can't collide with real category names (e.g. a user category called "Other"). */
export const OTHER_KEY = '__other__';
export const UNCATEGORIZED_KEY = '__uncategorized__';
export const OTHER_LABEL = 'Everything else';
export const UNCATEGORIZED_LABEL = 'Uncategorized';

export interface TrendSegment {
  key: string;
  name: string;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  month: string;
}

export interface TrendModel {
  series: { key: string; name: string; color: string }[];
  bars: { month: string; label: string; x: number; total: number; income: number; segments: TrendSegment[] }[];
  ticks: { y: number; value: number }[];
  incomePath: string;
  incomePoints: { x: number; y: number; value: number; month: string }[];
  plotBottom: number;
  plotLeft: number;
  plotRight: number;
}

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

/**
 * Pure layout for the stacked spending bars (+ income line, same $ axis).
 * `exclude(name)` removes non-spending categories (income, transfers) from the stacks.
 */
export function buildTrendModel(points: TrendPoint[], exclude: (name: string) => boolean): TrendModel {
  const totals = new Map<string, number>();
  for (const p of points)
    for (const [name, v] of Object.entries(p.byCategory ?? {}))
      if (!exclude(name)) totals.set(name, (totals.get(name) ?? 0) + Math.abs(v));

  const ranked = [...totals.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const named = ranked.length > MAX_SERIES + 1 ? ranked.slice(0, MAX_SERIES) : ranked;
  const hasOther = ranked.length > named.length;

  // The server's byCategory excludes uncategorized spend; recover it from totalSpent.
  const uncategorizedOf = (p: TrendPoint) => {
    const categorized = Object.entries(p.byCategory ?? {})
      .filter(([name]) => !exclude(name))
      .reduce((sum, [, v]) => sum + Math.abs(v), 0);
    const diff = Math.round((Math.abs(p.totalSpent ?? 0) - categorized) * 100) / 100;
    return Math.max(0, diff);
  };
  const hasUncategorized = points.some((p) => uncategorizedOf(p) > 0);

  // Color follows the entity: assign slots alphabetically among named series so ranks don't repaint them.
  const order = [...named].sort((a, b) => a.localeCompare(b));
  const series = order.map((name, i) => ({ key: name, name, color: `var(--series-${i + 1})` }));
  if (hasOther) series.push({ key: OTHER_KEY, name: OTHER_LABEL, color: 'var(--series-8)' });
  if (hasUncategorized) series.push({ key: UNCATEGORIZED_KEY, name: UNCATEGORIZED_LABEL, color: 'var(--app-muted)' });

  const stacked = points.map((p) => {
    const vals = new Map<string, number>();
    for (const [name, v] of Object.entries(p.byCategory ?? {})) {
      if (exclude(name)) continue;
      const key = named.includes(name) ? name : OTHER_KEY;
      vals.set(key, (vals.get(key) ?? 0) + Math.abs(v));
    }
    const unc = uncategorizedOf(p);
    if (unc > 0) vals.set(UNCATEGORIZED_KEY, unc);
    return { p, vals };
  });

  const maxVal = Math.max(
    0,
    ...stacked.map(({ vals }) => [...vals.values()].reduce((a, b) => a + b, 0)),
    ...points.map((p) => Math.abs(p.totalIncome)),
  );
  const top = niceMax(maxVal);
  const plotH = H - PAD.top - PAD.bottom;
  const plotW = W - PAD.left - PAD.right;
  const yOf = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const slot = points.length ? plotW / points.length : plotW;
  const barW = Math.min(56, slot * 0.6);

  const bars = stacked.map(({ p, vals }, i) => {
    const cx = PAD.left + slot * i + slot / 2;
    let acc = 0;
    const segments: TrendSegment[] = [];
    for (const s of series) {
      const v = vals.get(s.key) ?? 0;
      if (v <= 0) continue;
      const y1 = yOf(acc + v);
      const y0 = yOf(acc);
      // 2px surface gap between stacked segments.
      segments.push({ key: s.key, name: s.name, value: v, x: cx - barW / 2, y: y1 + 1, w: barW, h: Math.max(0, y0 - y1 - 2), color: s.color, month: p.month });
      acc += v;
    }
    return { month: p.month, label: shortMonth(p.month), x: cx, total: acc, income: Math.abs(p.totalIncome), segments };
  });

  const incomePoints = bars.map((b) => ({ x: b.x, y: yOf(b.income), value: b.income, month: b.month }));
  const incomePath = incomePoints.map((pt, i) => `${i ? 'L' : 'M'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ value: top * f, y: yOf(top * f) }));

  return { series, bars, ticks, incomePath, incomePoints, plotBottom: yOf(0), plotLeft: PAD.left, plotRight: W - PAD.right };
}

@Component({
  selector: 'app-trend-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, MatButtonModule],
  template: `
    @if (!points().length) {
      <p class="empty-state">No history yet.</p>
    } @else {
      <div class="legend" aria-hidden="true">
        @for (s of model().series; track s.key) {
          <span class="key"><span class="swatch" [style.background]="s.color"></span>{{ s.name }}</span>
        }
        <span class="key"><span class="line-swatch"></span>Income</span>
      </div>

      @if (!showTable()) {
        <div class="chart-wrap">
          <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" aria-label="Spending by category over recent months, with income line">
            @for (t of model().ticks; track t.value) {
              <line class="grid" [attr.x1]="model().plotLeft" [attr.x2]="model().plotRight" [attr.y1]="t.y" [attr.y2]="t.y" />
              <text class="tick" [attr.x]="model().plotLeft - 6" [attr.y]="t.y + 4" text-anchor="end">
                {{ t.value | currency: 'USD' : 'symbol' : '1.0-0' }}
              </text>
            }
            <line class="axis" [attr.x1]="model().plotLeft" [attr.x2]="model().plotRight" [attr.y1]="model().plotBottom" [attr.y2]="model().plotBottom" />
            @for (b of model().bars; track b.month) {
              @for (s of b.segments; track s.key; let last = $last) {
                <rect
                  class="seg"
                  [attr.x]="s.x"
                  [attr.y]="s.y"
                  [attr.width]="s.w"
                  [attr.height]="s.h"
                  [attr.rx]="last ? 4 : 0"
                  [style.fill]="s.color"
                  (mouseenter)="hover.set({ x: s.x + s.w / 2, y: s.y, title: b.label + ' · ' + s.name, value: s.value })"
                  (mouseleave)="hover.set(null)"
                />
              }
              <text class="tick" [attr.x]="b.x" [attr.y]="model().plotBottom + 18" text-anchor="middle">{{ b.label }}</text>
            }
            <path class="income" [attr.d]="model().incomePath" />
            @for (p of model().incomePoints; track p.month) {
              <circle
                class="income-dot"
                [attr.cx]="p.x"
                [attr.cy]="p.y"
                r="4"
                (mouseenter)="hover.set({ x: p.x, y: p.y, title: p.month + ' · Income', value: p.value })"
                (mouseleave)="hover.set(null)"
              />
            }
          </svg>
          @if (hover(); as hv) {
            <div class="tooltip" [style.left.%]="(hv.x / w) * 100" [style.top.%]="(hv.y / h) * 100">
              <div>{{ hv.title }}</div>
              <strong class="tabular">{{ hv.value | currency }}</strong>
            </div>
          }
        </div>
      } @else {
        <table class="data-table">
          <thead>
            <tr><th>Month</th><th>Income</th><th>Spent</th></tr>
          </thead>
          <tbody>
            @for (p of points(); track p.month) {
              <tr>
                <td>{{ p.month }}</td>
                <td class="tabular">{{ p.totalIncome | currency }}</td>
                <td class="tabular">{{ p.totalSpent | currency }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
      <button mat-button class="toggle" (click)="showTable.set(!showTable())">
        {{ showTable() ? 'Show chart' : 'Show table' }}
      </button>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 8px;
    }
    .key {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .swatch {
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
    .line-swatch {
      width: 14px;
      height: 0;
      border-top: 2px dashed var(--mat-sys-on-surface);
    }
    .chart-wrap {
      position: relative;
    }
    svg {
      width: 100%;
      height: auto;
      display: block;
    }
    .grid {
      stroke: var(--app-grid);
      stroke-width: 1;
    }
    .axis {
      stroke: var(--app-axis);
      stroke-width: 1;
    }
    .tick {
      fill: var(--app-muted);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
    .seg:hover {
      opacity: 0.85;
    }
    .income {
      fill: none;
      stroke: var(--mat-sys-on-surface);
      stroke-width: 2;
      stroke-dasharray: 5 4;
    }
    .income-dot {
      fill: var(--mat-sys-on-surface);
      stroke: var(--mat-sys-surface);
      stroke-width: 2;
    }
    .tooltip {
      position: absolute;
      transform: translate(-50%, calc(-100% - 8px));
      background: var(--mat-sys-inverse-surface);
      color: var(--mat-sys-inverse-on-surface);
      padding: 6px 10px;
      border-radius: 6px;
      font: var(--mat-sys-body-small);
      pointer-events: none;
      white-space: nowrap;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      th,
      td {
        text-align: left;
        padding: 4px 8px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }
    .toggle {
      margin-top: 4px;
    }
  `,
})
export class TrendChart {
  readonly points = input.required<TrendPoint[]>();
  /** Names to leave out of the spending stacks (income + transfer categories). */
  readonly exclude = input<(name: string) => boolean>(() => false);

  protected readonly w = W;
  protected readonly h = H;
  protected readonly showTable = signal(false);
  protected readonly hover = signal<{ x: number; y: number; title: string; value: number } | null>(null);
  protected readonly model = computed(() => buildTrendModel(this.points(), this.exclude()));
}
