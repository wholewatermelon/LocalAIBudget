import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FileType, ParseMethod, StatementFile } from '../../core/models';

export const FILE_ICON: Record<FileType, string> = {
  pdf: 'picture_as_pdf',
  txt: 'description',
  csv: 'table_view',
  ofx: 'account_balance',
  qfx: 'account_balance',
};

export const PARSE_METHOD_LABEL: Record<ParseMethod, string> = {
  regex: 'Parsed (text)',
  csv: 'Parsed (CSV)',
  llm: 'Parsed by AI',
  ofx: 'Parsed (OFX)',
};

export interface ReconBadge {
  icon: string;
  label: string;
  cls: 'ok' | 'mismatch' | 'unknown';
  tooltip: string;
}

/** MVP-C: per-file reconciliation badge (opening + transactions = closing). */
export function reconciliationBadge(f: StatementFile): ReconBadge {
  switch (f.reconciliationStatus) {
    case 'ok':
      return { icon: 'check_circle', label: 'Reconciled', cls: 'ok', tooltip: 'Opening balance + transactions = closing balance' };
    case 'mismatch': {
      const diff = Math.abs(f.reconciliationDiff ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      return {
        icon: 'warning',
        label: `Off by ${diff} — rows may be missing`,
        cls: 'mismatch',
        tooltip: 'The parsed transactions do not add up to the statement balances',
      };
    }
    default:
      return { icon: 'help', label: 'Not reconciled', cls: 'unknown', tooltip: 'No statement balances found to check against' };
  }
}

export function fileIcon(type: string): string {
  return FILE_ICON[type as FileType] ?? 'draft';
}

export function parseMethodLabel(m: string | null): string {
  if (!m) return 'Not processed';
  return PARSE_METHOD_LABEL[m as ParseMethod] ?? m;
}

@Component({
  selector: 'app-statement-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatListModule, MatIconModule, MatButtonModule, MatTooltipModule, DatePipe, DecimalPipe],
  template: `
    @if (files().length === 0) {
      <p class="empty-state">No statement files for this month. Upload some above.</p>
    } @else {
      <mat-list>
        @for (f of files(); track f.id) {
          <mat-list-item data-testid="statement-file" lines="3">
            <mat-icon matListItemIcon>{{ icon(f.fileType) }}</mat-icon>
            <span matListItemTitle>{{ f.fileName }}</span>
            @let rb = recon(f);
            <span matListItemLine>
              <span class="recon" [class]="'recon ' + rb.cls" [matTooltip]="rb.tooltip" data-testid="recon-badge">
                <mat-icon>{{ rb.icon }}</mat-icon>{{ rb.label }}
              </span>
            </span>
            <span matListItemLine class="meta">
              {{ f.accountName ?? 'Unknown account' }}
              · {{ (f.sizeBytes ?? 0) / 1024 | number: '1.0-0' }} KB
              · {{ f.transactionCount }} txns
              · {{ methodLabel(f.lastParseMethod) }}
              @if (f.lastProcessedAt) {
                · {{ f.lastProcessedAt | date: 'short' }}
              }
            </span>
            <button
              matListItemMeta
              mat-icon-button
              [disabled]="disabled()"
              (click)="remove.emit(f)"
              [matTooltip]="'Delete ' + f.fileName"
              [attr.aria-label]="'Delete ' + f.fileName"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </mat-list-item>
        }
      </mat-list>
    }
  `,
  styles: `
    .recon {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
      vertical-align: middle;
      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
    }
    .recon.ok mat-icon {
      color: var(--app-good);
    }
    .recon.mismatch {
      color: var(--mat-sys-error);
    }
    .meta {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class StatementList {
  readonly files = input.required<StatementFile[]>();
  readonly disabled = input(false);
  readonly remove = output<StatementFile>();

  protected readonly icon = fileIcon;
  protected readonly methodLabel = parseMethodLabel;
  protected readonly recon = reconciliationBadge;
}
