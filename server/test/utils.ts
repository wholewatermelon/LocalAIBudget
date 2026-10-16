import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MIGRATIONS_DIR } from '../src/config/app-config';
import { DbService } from '../src/db/db.service';
import { JobsService } from '../src/jobs/jobs.service';
import {
  LLM_CLIENT,
  LlmClient,
  LlmJsonRequest,
  LlmUnavailableError,
} from '../src/llm/llm-client';

export const REPO_FIXTURES = path.resolve(
  __dirname,
  '..',
  '..',
  'fixtures',
  'statements',
);

/** Keyword categorizer: deterministic stand-in for Gemma. Unknown merchants get an invalid name → Other. */
const KEYWORDS: [RegExp, string][] = [
  [/PAYROLL|INTEREST PAYMENT|DEPOSIT/i, 'Income'],
  [
    /PAYMENT THANK YOU|AUTOMATIC PAYMENT|TRANSFER|AUTOPAY.*CARD|CARD AUTOPAY|ONLINE PMT SUMMIT/i,
    'Transfer',
  ],
  [/WALMART|AMAZON|AMZN|TARGET|HOME DEPOT|APPLE/i, 'Shopping'],
  [/SHELL|CHEVRON|FUEL|LYFT|UBER(?! \*EATS)|ALASKA AIR/i, 'Transport'],
  [/NETFLIX|SPOTIFY/i, 'Entertainment'],
  [/WATER|POWER|BROADBAND|WIRELESS/i, 'Utilities'],
  [
    /MCDONALDS|PIZZA|TACO|SUBWAY|BISCUITS|OLIVE GARDEN|EATS|TRATTORIA/i,
    'Restaurants',
  ],
  [/KROGER|GROCERY|TRADER JOE|FRED-MEYER/i, 'Food'],
  [/MORTGAGE|MTG|RENT/i, 'Housing'],
];

export class FakeLlm implements LlmClient {
  readonly model = 'fake-llm';
  calls: LlmJsonRequest[] = [];
  /** When set, categorize calls wait for this promise (lets tests hold a job in "running"). */
  gate: Promise<void> | null = null;
  unavailable = false;
  /** Errors thrown (in order) by the next categorize/insights calls, e.g. LlmTimeoutError. */
  failNext: Error[] = [];

  hold(): () => void {
    let release!: () => void;
    this.gate = new Promise<void>((r) => (release = r));
    return () => {
      this.gate = null;
      release();
    };
  }

  async generateJson(req: LlmJsonRequest): Promise<unknown> {
    this.calls.push(req);
    if (this.unavailable)
      throw new LlmUnavailableError('Ollama is not reachable (fake)');
    if (
      (req.task === 'categorize' || req.task === 'insights') &&
      this.failNext.length
    ) {
      throw this.failNext.shift()!;
    }
    if (req.task === 'categorize') {
      if (this.gate) await this.gate;
      const tx = JSON.parse(/Transactions:\n(.*)\n/.exec(req.prompt)![1]) as {
        id: number;
        description: string;
      }[];
      return {
        results: tx.map((t) => {
          const hit = KEYWORDS.find(([re]) => re.test(t.description));
          return {
            id: t.id,
            category: hit ? hit[1] : 'NotACategory',
            confidence: hit ? 0.95 : 0.4,
          };
        }),
      };
    }
    if (req.task === 'insights') {
      return {
        summary: 'Fake summary: spending was steady.',
        suggestions: [
          { categoryName: 'Food', suggestedLimit: 400, reason: 'average' },
          { categoryName: 'Imaginary', suggestedLimit: 10, reason: 'dropped' },
        ],
      };
    }
    if (req.task === 'extract') return { transactions: [] };
    return {};
  }

  health() {
    return Promise.resolve({
      reachable: !this.unavailable,
      modelAvailable: !this.unavailable,
    });
  }
}

export interface TestContext {
  app: INestApplication<App>;
  llm: FakeLlm;
  db: DbService;
  jobs: JobsService;
  statementsDir: string;
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestContext> {
  const llm = new FakeLlm();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LLM_CLIENT)
    .useValue(llm)
    .compile();
  const app = configureApp(
    moduleRef.createNestApplication(),
  ) as INestApplication<App>;
  await app.init();
  const db = app.get(DbService);
  await resetDb(db);
  const statementsDir = process.env.STATEMENTS_DIR!;
  fs.rmSync(statementsDir, { recursive: true, force: true });
  fs.mkdirSync(statementsDir, { recursive: true });
  return {
    app,
    llm,
    db,
    jobs: app.get(JobsService),
    statementsDir,
    http: () => request(app.getHttpServer()),
  };
}

/** Truncates all app tables and re-seeds by re-running the (idempotent) migration 001. */
export async function resetDb(db: DbService): Promise<void> {
  if (
    !/_test$/.test(String((await db.one('SELECT current_database() AS d'))!.d))
  ) {
    throw new Error('resetDb refused: not a *_test database');
  }
  await db.query(
    `TRUNCATE budget_month_items, budget_main_items, ai_insights, processing_jobs, transaction_splits, transactions, statement_files, category_rules, accounts, categories
     RESTART IDENTITY CASCADE`,
  );
  await db.query(
    fs.readFileSync(
      path.join(MIGRATIONS_DIR, '001_initial_schema.sql'),
      'utf8',
    ),
  );
}

export async function waitForJob(ctx: TestContext, id: number): Promise<any> {
  await ctx.jobs.waitForIdle();
  const res = await ctx.http().get(`/api/jobs/${id}`).expect(200);
  return res.body;
}

export async function processMonth(
  ctx: TestContext,
  month: string,
  mode?: string,
): Promise<any> {
  const res = await ctx
    .http()
    .post('/api/jobs/process')
    .send(mode ? { month, mode } : { month })
    .expect(202);
  return waitForJob(ctx, res.body.id);
}

/** Small PDF in the simple synthetic layout (regex-parsable). */
export function makePdf(title: string, lines: string[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.fontSize(16).text(title);
    doc.fontSize(10).text('Date Description Amount');
    for (const l of lines) doc.text(l);
    doc.end();
  });
}

export function copyFixture(
  ctx: TestContext,
  file: string,
  month: string,
): void {
  const dir = path.join(ctx.statementsDir, month);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(REPO_FIXTURES, file), path.join(dir, file));
}
