import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AccountsService } from '../accounts/accounts.service';
import { isMonth } from '../common/month';
import { APP_CONFIG } from '../config/app-config';
import type { AppConfig } from '../config/app-config';
import { DbService, iso, num, numOrNull } from '../db/db.service';
import { FileType } from '../parsing/parse.types';
import { parseStatementFileName, sanitizeFileName } from './file-naming';

export interface StatementFile {
  id: number;
  month: string;
  fileName: string;
  fileType: FileType;
  accountId: number | null;
  accountName: string | null;
  accountType: string | null;
  sizeBytes: number | null;
  uploadedAt: string | null;
  lastProcessedAt: string | null;
  lastParseMethod: string | null;
  transactionCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  parsedTotal: number | null;
  reconciliationStatus: 'ok' | 'mismatch' | 'unknown';
  reconciliationDiff: number | null;
}

export interface MonthSummary {
  month: string;
  fileCount: number;
  transactionCount: number;
  uncategorizedCount: number;
  needsReviewCount: number;
  reconciliationIssues: number;
  lastProcessedAt: string | null;
}

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

const SELECT = `
  SELECT f.*, a.account_name, a.account_type,
    (SELECT count(*) FROM transactions t WHERE t.statement_file_id = f.id) AS transaction_count
  FROM statement_files f LEFT JOIN accounts a ON a.id = f.account_id`;

function toFile(r: any): StatementFile {
  return {
    id: r.id,
    month: r.month,
    fileName: r.file_name,
    fileType: r.file_type,
    accountId: r.account_id,
    accountName: r.account_name ?? null,
    accountType: r.account_type ?? null,
    sizeBytes: r.size_bytes,
    uploadedAt: iso(r.uploaded_at),
    lastProcessedAt: iso(r.last_processed_at),
    lastParseMethod: r.last_parse_method,
    transactionCount: num(r.transaction_count),
    periodStart: r.period_start ?? null,
    periodEnd: r.period_end ?? null,
    openingBalance: numOrNull(r.opening_balance),
    closingBalance: numOrNull(r.closing_balance),
    parsedTotal: numOrNull(r.parsed_total),
    reconciliationStatus: r.reconciliation_status ?? 'unknown',
    reconciliationDiff: numOrNull(r.reconciliation_diff),
  };
}

export interface ReconciliationUpdate {
  periodStart: string | null;
  periodEnd: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  parsedTotal: number;
  status: 'ok' | 'mismatch' | 'unknown';
  diff: number | null;
}

@Injectable()
export class StatementsService {
  constructor(
    private readonly db: DbService,
    private readonly accounts: AccountsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  monthDir(month: string): string {
    if (!isMonth(month)) throw new BadRequestException('month must be YYYY-MM');
    return path.join(this.config.statementsDir, month);
  }

  filePath(f: { month: string; fileName: string }): string {
    return path.join(this.monthDir(f.month), f.fileName);
  }

  /** Statement files currently on disk for a month (supported extensions only). */
  async filesOnDisk(
    month: string,
  ): Promise<{ fileName: string; size: number }[]> {
    const dir = this.monthDir(month);
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      return [];
    }
    const out: { fileName: string; size: number }[] = [];
    for (const n of names) {
      if (!parseStatementFileName(n)) continue;
      const st = await fs.stat(path.join(dir, n)).catch(() => null);
      if (st?.isFile()) out.push({ fileName: n, size: st.size });
    }
    return out.sort((a, b) => a.fileName.localeCompare(b.fileName));
  }

  /** Registers files found on disk (auto-creating accounts) and forgets rows whose file disappeared. */
  async syncMonth(month: string): Promise<StatementFile[]> {
    const onDisk = await this.filesOnDisk(month);
    for (const f of onDisk)
      await this.register(month, f.fileName, f.size, false);
    await this.db.query(
      'DELETE FROM statement_files WHERE month = $1 AND NOT (file_name = ANY($2::text[]))',
      [month, onDisk.map((f) => f.fileName)],
    );
    return this.list(month, false);
  }

  private async register(
    month: string,
    fileName: string,
    size: number,
    uploaded: boolean,
  ): Promise<number> {
    const parsed = parseStatementFileName(fileName)!;
    const account = await this.accounts.ensure(parsed.accountName);
    const r = await this.db.one<{ id: number }>(
      `INSERT INTO statement_files (month, file_name, file_type, account_id, size_bytes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (month, file_name) DO UPDATE SET size_bytes = EXCLUDED.size_bytes, file_type = EXCLUDED.file_type,
         account_id = COALESCE(statement_files.account_id, EXCLUDED.account_id)
         ${uploaded ? ', uploaded_at = now()' : ''}
       RETURNING id`,
      [month, fileName, parsed.fileType, account.id, size],
    );
    return r!.id;
  }

  async list(month: string, sync = true): Promise<StatementFile[]> {
    if (sync) return this.syncMonth(month);
    return (
      await this.db.query(`${SELECT} WHERE f.month = $1 ORDER BY f.file_name`, [
        month,
      ])
    ).map(toFile);
  }

  async get(id: number): Promise<StatementFile> {
    const r = await this.db.one(`${SELECT} WHERE f.id = $1`, [id]);
    if (!r) throw new NotFoundException(`Statement file ${id} not found`);
    return toFile(r);
  }

  async upload(
    files: UploadedFile[],
    monthField?: string,
  ): Promise<StatementFile[]> {
    if (!files?.length)
      throw new BadRequestException(
        'No files uploaded (multipart field "files")',
      );
    if (monthField !== undefined && monthField !== '' && !isMonth(monthField)) {
      throw new BadRequestException('month must be YYYY-MM');
    }
    // Validate everything before writing anything.
    const planned = files.map((f) => {
      const fileName = sanitizeFileName(f.originalname);
      const parsed = parseStatementFileName(fileName);
      if (!parsed) {
        throw new BadRequestException(
          `Unsupported file type: ${f.originalname} (allowed: .pdf, .csv, .txt, .ofx, .qfx)`,
        );
      }
      // A YYYY-MM in the file name wins over the form field (ARCHITECTURE.md F.3).
      const month = parsed.month ?? (monthField || null);
      if (!month) {
        throw new BadRequestException(
          `Cannot determine month for ${f.originalname}: pass a "month" field or include YYYY-MM in the file name`,
        );
      }
      return { f, fileName, month };
    });
    const ids: number[] = [];
    for (const p of planned) {
      const dir = this.monthDir(p.month);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, p.fileName), p.f.buffer);
      ids.push(await this.register(p.month, p.fileName, p.f.size, true));
    }
    return Promise.all(ids.map((id) => this.get(id)));
  }

  async remove(id: number): Promise<void> {
    const f = await this.get(id);
    await fs.unlink(this.filePath(f)).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
    await this.db.query('DELETE FROM statement_files WHERE id = $1', [id]);
  }

  async markProcessed(
    id: number,
    method: string,
    rec: ReconciliationUpdate,
  ): Promise<void> {
    await this.db.query(
      `UPDATE statement_files SET last_processed_at = now(), last_parse_method = $2,
         period_start = $3, period_end = $4, opening_balance = $5, closing_balance = $6,
         parsed_total = $7, reconciliation_status = $8, reconciliation_diff = $9
       WHERE id = $1`,
      [
        id,
        method,
        rec.periodStart,
        rec.periodEnd,
        rec.openingBalance,
        rec.closingBalance,
        rec.parsedTotal,
        rec.status,
        rec.diff,
      ],
    );
  }

  /** Union of month folders on disk and months present in transactions (by transaction_date), newest first. */
  async months(): Promise<MonthSummary[]> {
    let dirs: string[] = [];
    try {
      dirs = (
        await fs.readdir(this.config.statementsDir, { withFileTypes: true })
      )
        .filter((d) => d.isDirectory() && isMonth(d.name))
        .map((d) => d.name);
    } catch {
      dirs = [];
    }
    const txRows = await this.db.query(
      `SELECT to_char(t.transaction_date, 'YYYY-MM') AS month, count(*) AS total,
         count(*) FILTER (WHERE t.category_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id)) AS uncategorized,
         count(*) FILTER (WHERE t.needs_review) AS needs_review
       FROM transactions t GROUP BY 1`,
    );
    const fileRows = await this.db.query(
      `SELECT month, max(last_processed_at) AS last,
         count(*) FILTER (WHERE reconciliation_status = 'mismatch') AS mismatches
       FROM statement_files GROUP BY month`,
    );
    const all = new Set<string>([
      ...dirs,
      ...txRows.map((r) => r.month as string),
    ]);
    const out: MonthSummary[] = [];
    for (const month of all) {
      const tx = txRows.find((r) => r.month === month);
      const f = fileRows.find((r) => r.month === month);
      out.push({
        month,
        fileCount: dirs.includes(month)
          ? (await this.filesOnDisk(month)).length
          : 0,
        transactionCount: num(tx?.total),
        uncategorizedCount: num(tx?.uncategorized),
        needsReviewCount: num(tx?.needs_review),
        reconciliationIssues: num(f?.mismatches),
        lastProcessedAt: iso(f?.last),
      });
    }
    return out.sort((a, b) => b.month.localeCompare(a.month));
  }
}
