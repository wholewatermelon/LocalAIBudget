/* Runs in every e2e test file before modules load: point the app at the TEST database and a temp statements dir. */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ENV_FILE } from '../src/config/app-config';

dotenv.config({ path: ENV_FILE, quiet: true });
const testDb = process.env.DB_NAME_TEST || 'localaibudget_test';
if (testDb === (process.env.DB_NAME || 'localaibudget')) {
  throw new Error(
    'DB_NAME_TEST must differ from DB_NAME — refusing to run e2e tests against the dev database',
  );
}
process.env.DB_NAME = testDb;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'localaibudget-e2e-'));
process.env.STATEMENTS_DIR = dir;
