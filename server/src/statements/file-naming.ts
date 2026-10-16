import { FileType } from '../parsing/parse.types';

/** Lower = preferred when several files share a basename (OFX/QFX > CSV > PDF > TXT). */
const PREFERENCE: Record<FileType, number> = {
  ofx: 0,
  qfx: 0,
  csv: 1,
  pdf: 2,
  txt: 3,
};
export const SUPPORTED_EXTENSIONS = Object.keys(PREFERENCE);

export interface StatementFileName {
  fileName: string;
  /** File name without extension, lower-cased (grouping key for the format preference). */
  baseKey: string;
  fileType: FileType;
  accountName: string;
  month: string | null;
}

/**
 * `Main_Checking_2024-01.pdf` → { accountName: 'Main Checking', month: '2024-01', fileType: 'pdf' }.
 * Returns null for unsupported extensions.
 */
export function parseStatementFileName(
  fileName: string,
): StatementFileName | null {
  const m = /^(.+)\.(pdf|txt|csv|ofx|qfx)$/i.exec(fileName);
  if (!m) return null;
  const stem = m[1];
  const fileType = m[2].toLowerCase() as FileType;
  const months = [...stem.matchAll(/(\d{4})-(0[1-9]|1[0-2])(?!\d)/g)];
  const last = months[months.length - 1];
  const month = last ? `${last[1]}-${last[2]}` : null;
  const accountName =
    stem
      .replace(/[_\s-]*\d{4}-(0[1-9]|1[0-2])(-\d{2})?(?!\d)[_\s-]*/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Unknown Account';
  return {
    fileName,
    baseKey: stem.toLowerCase(),
    fileType,
    accountName,
    month,
  };
}

/** Keeps one file per basename by format preference. Result sorted by file name. */
export function selectFilesToProcess<T extends { fileName: string }>(
  files: T[],
): T[] {
  const best = new Map<string, { f: T; rank: number }>();
  for (const f of files) {
    const p = parseStatementFileName(f.fileName);
    if (!p) continue;
    const rank = PREFERENCE[p.fileType];
    const cur = best.get(p.baseKey);
    if (!cur || rank < cur.rank) best.set(p.baseKey, { f, rank });
  }
  return [...best.values()]
    .map((v) => v.f)
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

/** Strips any path components and unsafe characters from an uploaded file name. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  return base
    .replace(/[^A-Za-z0-9._ ()-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 200);
}
