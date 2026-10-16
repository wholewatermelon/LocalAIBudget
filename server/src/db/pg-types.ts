import { types } from 'pg';

let installed = false;
/** Keep DATE columns as 'YYYY-MM-DD' strings (default parser makes local-time Date objects → TZ bugs). */
export function installPgTypeParsers(): void {
  if (installed) return;
  types.setTypeParser(1082, (v: string) => v); // date
  installed = true;
}
