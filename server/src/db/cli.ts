/* Usage: ts-node src/db/cli.ts migrate | reset --yes   (DB from repo-root .env; DB_NAME overrides) */
import * as dotenv from 'dotenv';
import { buildConfig, ENV_FILE, MIGRATIONS_DIR } from '../config/app-config';
import { ensureDatabase, resetSchema, runMigrations } from './migrator';

async function main(): Promise<void> {
  dotenv.config({ path: ENV_FILE, quiet: true });
  const cfg = buildConfig(process.env);
  const [cmd, ...args] = process.argv.slice(2);
  const target = `${cfg.db.database}@${cfg.db.host}:${cfg.db.port}`;
  if (cmd === 'migrate') {
    if (await ensureDatabase(cfg.db))
      console.log(`Created database ${cfg.db.database}`);
    const r = await runMigrations(cfg.db, MIGRATIONS_DIR, console.log);
    console.log(
      `Migrations on ${target}: ${r.applied.length} applied, ${r.skipped.length} already applied.`,
    );
  } else if (cmd === 'reset') {
    if (!args.includes('--yes')) {
      console.error(
        `db:reset DROPS ALL DATA in ${target}. Re-run with --yes to confirm (npm run db:reset -- --yes).`,
      );
      process.exit(1);
    }
    await resetSchema(cfg.db);
    console.log(`Schema dropped on ${target}.`);
    const r = await runMigrations(cfg.db, MIGRATIONS_DIR, console.log);
    console.log(`Re-applied ${r.applied.length} migrations.`);
  } else {
    console.error('Usage: cli.ts migrate | reset --yes');
    process.exit(1);
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
