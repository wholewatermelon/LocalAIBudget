import { LlmClient } from '../llm/llm-client';
import {
  applyCsvMapping,
  CsvStatementParser,
  detectCsvMapping,
  readCsvRecords,
  validateLlmMapping,
} from './csv.parser';
import {
  chunkPages,
  LlmExtractionParser,
  validateExtractedRows,
} from './llm-extraction.parser';
import { ofxDescription, parseOfx } from './ofx.parser';
import { ParseContext } from './parse.types';
import { reconcile } from './reconciliation';
import { parseRegexLines } from './regex-line.parser';
import { normalizeSigns } from './sign-normalization';
import { StatementParserService } from './statement-parser.service';
import {
  parseRunningBalanceTable,
  parseTwoDateTable,
} from './table-layout.parser';
import {
  detectBalances,
  detectStatementPeriod,
  inferYear,
  parseAmount,
  parseDate,
} from './values';

function fakeLlm(respond: (task: string, prompt: string) => unknown) {
  const calls: { task: string; prompt: string }[] = [];
  const llm: LlmClient = {
    model: 'fake',
    generateJson: jest.fn((req: { task: string; prompt: string }) => {
      calls.push(req);
      return Promise.resolve(respond(req.task, req.prompt));
    }),
    health: () => Promise.resolve({ reachable: true, modelAvailable: true }),
  };
  return { llm, calls };
}

const ctx = (over: Partial<ParseContext> = {}): ParseContext => ({
  fileName: 'Main_Checking_2024-01.txt',
  fileType: 'txt',
  month: '2024-01',
  accountType: 'Bank',
  ...over,
});

describe('regex line parser', () => {
  it('parses dates, descriptions, commas in amounts and negatives; ignores junk lines', () => {
    const text = [
      'Main Checking Statement',
      'Period: 2024-01',
      'Date Description Amount',
      '------------------------',
      '2024-01-05 Walmart Store 1234 -150.25',
      '2024-01-12 Employer Payroll 2,500.00',
      '  2024-01-15   City   Water Dept   -1,060.00  ',
      '2024-01-20 McDonalds 12.5', // only one decimal → not a row
      'garbage 2024-01-21 thing -1.00',
      '2024-02-30 Impossible Date -5.00',
      '',
      '-- 1 of 1 --',
    ].join('\r\n');
    const { rows, issues } = parseRegexLines(text);
    expect(rows).toEqual([
      {
        date: '2024-01-05',
        description: 'Walmart Store 1234',
        amount: -150.25,
        rawText: '2024-01-05 Walmart Store 1234 -150.25',
      },
      {
        date: '2024-01-12',
        description: 'Employer Payroll',
        amount: 2500,
        rawText: '2024-01-12 Employer Payroll 2,500.00',
      },
      {
        date: '2024-01-15',
        description: 'City Water Dept',
        amount: -1060,
        rawText: '2024-01-15   City   Water Dept   -1,060.00',
      },
    ]);
    expect(issues).toHaveLength(1);
  });

  it('returns no rows for empty text', () => {
    expect(parseRegexLines('').rows).toEqual([]);
  });
});

describe('value parsing', () => {
  it.each([
    ['1,234.56', 1234.56],
    ['-$12.00', -12],
    ['$-12.00', -12],
    ['(12.34)', -12.34],
    ['12.34-', -12.34],
    ['+$1,134.81', 1134.81],
    ['12.34 CR', 12.34],
    ['abc', null],
    ['', null],
    ['1.2.3', null],
  ])('parseAmount(%p) = %p', (s, n) => expect(parseAmount(s)).toBe(n));

  it.each([
    ['2024-01-05', '2024-01-05'],
    ['01/05/2024', '2024-01-05'],
    ['1/5/24', '2024-01-05'],
    ['December 1, 2024', '2024-12-01'],
    ['Nov 15, 2024', '2024-11-15'],
    ['02/30/2024', null],
    ['nope', null],
  ])('parseDate(%p) = %p', (s, d) => expect(parseDate(s)).toBe(d));

  it('infers the year for MM/DD across a Dec→Jan statement period', () => {
    const period = { start: '2024-12-05', end: '2025-01-04' };
    expect(parseDate('12/03', period)).toBe('2024-12-03');
    expect(parseDate('01/02', period)).toBe('2025-01-02');
    expect(inferYear(2, 3, { start: '2025-01-05', end: '2025-02-04' })).toBe(
      2025,
    );
    expect(parseDate('12/31', null, '2025-01')).toBe('2024-12-31');
  });

  it('detects statement periods and balances', () => {
    expect(
      detectStatementPeriod('Opening/Closing Date 12/05/24 - 01/04/25'),
    ).toEqual({ start: '2024-12-05', end: '2025-01-04' });
    expect(
      detectStatementPeriod('December 1, 2024 through December 31, 2024'),
    ).toEqual({ start: '2024-12-01', end: '2024-12-31' });
    expect(detectStatementPeriod('nothing here')).toBeNull();
    expect(
      detectBalances(
        'Beginning Balance $8,999.58\nEnding Balance 18 $3,953.55\nDAILY ENDING BALANCE\n12/01 $1.00',
      ),
    ).toEqual({
      openingBalance: 8999.58,
      closingBalance: 3953.55,
    });
    expect(
      detectBalances('Previous Balance $5,528.28\nNew Balance $4,924.65'),
    ).toEqual({ openingBalance: 5528.28, closingBalance: 4924.65 });
  });
});

describe('sign normalization', () => {
  const rows = (amounts: number[]) =>
    amounts.map((amount) => ({ date: '2024-01-01', description: 'x', amount }));
  it('negates card statements that list charges as positive', () => {
    const r = normalizeSigns(rows([10, 20, -30]), 'Credit Card');
    expect(r.flipped).toBe(true);
    expect(r.rows.map((x) => x.amount)).toEqual([-10, -20, 30]);
  });
  it('leaves already-signed card data and bank data alone', () => {
    expect(normalizeSigns(rows([-10, -20, 30]), 'Credit Card').flipped).toBe(
      false,
    );
    expect(normalizeSigns(rows([10, 20, -30]), 'Bank').flipped).toBe(false);
  });
});

describe('CSV parser', () => {
  it('handles BOM, preamble, quoted commas and Debit/Credit columns', () => {
    const csv =
      '\uFEFFBank Export\r\nAccount: X\r\n\r\nDate,Description,Debit,Credit,Balance\r\n01/03/2025,"SQ *SMITH & SONS, LLC",10.00,,90.00\r\n01/02/2025,Payroll,,100.00,100.00\r\nTotal,,10.00,100.00,\r\n';
    const records = readCsvRecords(csv);
    const map = detectCsvMapping(records)!;
    expect(map).toMatchObject({
      headerRow: 2,
      date: 0,
      description: 1,
      amount: null,
      debit: 2,
      credit: 3,
      balance: 4,
    });
    const res = applyCsvMapping(records, map);
    expect(res.split).toBe(true);
    expect(res.rows.map((r) => [r.date, r.description, r.amount])).toEqual([
      ['2025-01-03', 'SQ *SMITH & SONS, LLC', -10],
      ['2025-01-02', 'Payroll', 100],
    ]);
    expect(res.issues).toHaveLength(1); // the Total line
  });

  it('prefers Transaction Date over Post Date', () => {
    const map = detectCsvMapping(
      readCsvRecords(
        'Post Date,Transaction Date,Description,Amount\n01/05/2025,01/03/2025,X,-1.00\n',
      ),
    )!;
    expect(map.date).toBe(1);
  });

  it('falls back to the LLM for unmappable headers and validates its mapping', async () => {
    const { llm, calls } = fakeLlm(() => ({
      headerRow: 0,
      date: 0,
      description: 1,
      amount: 2,
    }));
    const parser = new CsvStatementParser(llm);
    const res = await parser.parse({
      text: 'When,What,How much\n2025-01-02,Coffee,-3.50\n',
      pages: [],
      ctx: ctx({ fileType: 'csv' }),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].task).toBe('csv-mapping');
    expect(res!.rows).toEqual([
      expect.objectContaining({
        date: '2025-01-02',
        description: 'Coffee',
        amount: -3.5,
      }),
    ]);
    expect(
      validateLlmMapping({ date: 0, description: 9, amount: 1 }, [['a', 'b']]),
    ).toBeNull();
    expect(
      validateLlmMapping({ date: 0, description: 1 }, [['a', 'b']]),
    ).toBeNull();
    expect(validateLlmMapping('nonsense', [['a']])).toBeNull();
  });
});

describe('OFX parser', () => {
  it('reads SGML with unclosed tags, FITIDs, entities and a negative card ledger balance', () => {
    const sgml = `OFXHEADER:100\nDATA:OFXSGML\n\n<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<DTSTART>20241101050000.000[-5:EST]\n<DTEND>20241130050000.000[-5:EST]
<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20241103120000[-5:EST]\n<TRNAMT>-37.71\n<FITID>A1\n<NAME>SMITH &amp; SONS\n</STMTTRN>
<STMTTRN>\n<TRNTYPE>CREDIT\n<DTPOSTED>20241123\n<TRNAMT>500.00\n<FITID>A2\n<NAME>PAYMENT\n</STMTTRN>
</BANKTRANLIST><LEDGERBAL>\n<BALAMT>-419.64\n<DTASOF>20241130\n</LEDGERBAL></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;
    const r = parseOfx(sgml, 'Credit Card');
    expect(r.rows).toEqual([
      expect.objectContaining({
        date: '2024-11-03',
        description: 'SMITH & SONS',
        amount: -37.71,
        fitid: 'A1',
      }),
      expect.objectContaining({
        date: '2024-11-23',
        description: 'PAYMENT',
        amount: 500,
        fitid: 'A2',
      }),
    ]);
    expect(r.meta).toEqual({
      periodStart: '2024-11-01',
      periodEnd: '2024-11-30',
      closingBalance: 419.64,
      openingBalance: null,
    });
  });

  it('prefers MEMO when NAME is its truncated prefix', () => {
    expect(
      ofxDescription(
        'ACH DEBIT PINECREST HOME LOANS M',
        'ACH DEBIT PINECREST HOME LOANS MTG PYMT',
      ),
    ).toBe('ACH DEBIT PINECREST HOME LOANS MTG PYMT');
    expect(ofxDescription('CHECK', 'rent')).toBe('CHECK rent');
    expect(ofxDescription('X', null)).toBe('X');
  });
});

describe('PDF table layouts', () => {
  it('derives signs from the running balance and joins wrapped lines', () => {
    const text = [
      'Beginning Balance 100.00',
      '12/01 COFFEE SHOP 5.00 95.00',
      'PORTLAND OR',
      '12/02 PAYROLL 1,000.00 1,095.00',
      'Bank | Page 1 of 2',
      'HEADER LINE',
      '12/03 RENT 900.00 195.00',
      'Ending Balance 195.00',
      'DAILY ENDING BALANCE',
      '12/01 $95.00 12/02 $1,095.00',
    ].join('\n');
    const r = parseRunningBalanceTable(text, {
      start: '2024-12-01',
      end: '2024-12-31',
    })!;
    expect(r.rows.map((x) => [x.date, x.description, x.amount])).toEqual([
      ['2024-12-01', 'COFFEE SHOP PORTLAND OR', -5],
      ['2024-12-02', 'PAYROLL', 1000],
      ['2024-12-03', 'RENT', -900],
    ]);
    expect(r.issues).toEqual([]);
  });

  it('parses two-date card rows using the transaction date and skips section headers/totals', () => {
    const text = [
      'PAYMENTS AND OTHER CREDITS',
      '12/23 12/23 PAYMENT THANK YOU -1,850.00',
      'PURCHASES',
      '12/30 01/02 ALASKA AIR 412.60',
      'PASSENGER JORDAN',
      'TOTAL FEES FOR THIS PERIOD $5.59',
    ].join('\n');
    const r = parseTwoDateTable(text, {
      start: '2024-12-05',
      end: '2025-01-04',
    })!;
    expect(r.rows.map((x) => [x.date, x.description, x.amount])).toEqual([
      ['2024-12-23', 'PAYMENT THANK YOU', -1850],
      ['2024-12-30', 'ALASKA AIR PASSENGER JORDAN', 412.6],
    ]);
  });
});

describe('LLM extraction fallback', () => {
  it('validates rows: drops invalid dates/amounts, summary rows and out-of-period rows; applies kind', () => {
    const period = { start: '2024-12-05', end: '2025-01-04' };
    const { rows, issues } = validateExtractedRows(
      {
        transactions: [
          {
            date: '12/10',
            description: 'Starbucks',
            amount: 8.47,
            kind: 'debit',
          },
          {
            date: '01/02',
            description: 'Refund',
            amount: '34.99',
            kind: 'credit',
          },
          { date: 'yesterday', description: 'Bad date', amount: 1 },
          { date: '12/11', description: 'Bad amount', amount: 'lots' },
          { date: '12/12', description: '', amount: 1 },
          { date: '12/12', description: 'New Balance', amount: 4924.65 },
          {
            date: '06/01/2024',
            description: 'Way outside',
            amount: 5,
            kind: 'debit',
          },
          'not an object',
        ],
      },
      period,
      '2024-12',
    );
    expect(rows.map((r) => [r.date, r.description, r.amount])).toEqual([
      ['2024-12-10', 'Starbucks', -8.47],
      ['2025-01-02', 'Refund', 34.99],
    ]);
    expect(issues).toHaveLength(6);
  });

  it('accepts a bare array and chunks long pages', () => {
    expect(
      validateExtractedRows(
        [{ date: '2024-01-02', description: 'X', amount: -1 }],
        null,
        '2024-01',
      ).rows,
    ).toHaveLength(1);
    const long = Array.from(
      { length: 500 },
      (_, i) => `line ${i} ${'x'.repeat(30)}`,
    ).join('\n');
    const chunks = chunkPages([long, '', 'short page'], 6000);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.length <= 6000)).toBe(true);
    expect(chunks[chunks.length - 1]).toBe('short page');
  });

  it('is used only when the deterministic parsers find nothing, page by page', async () => {
    const { llm, calls } = fakeLlm((_task, prompt) =>
      prompt.includes('part 1 of 2')
        ? {
            statement: { openingBalance: 10, closingBalance: 5 },
            transactions: [
              { date: '01/03', description: 'Shop', amount: 5, kind: 'debit' },
            ],
          }
        : { transactions: [{ date: 'junk', description: 'x', amount: 1 }] },
    );
    const svc = new StatementParserService(llm);
    const res = await svc.parseText(
      'Odd layout\nShop on Jan 3rd five dollars',
      ['page one Shop', 'page two'],
      ctx({ fileType: 'pdf' }),
    );
    expect(calls.map((c) => c.task)).toEqual(['extract', 'extract']);
    expect(res.method).toBe('llm');
    expect(res.rows).toEqual([
      expect.objectContaining({
        date: '2024-01-03',
        description: 'Shop',
        amount: -5,
      }),
    ]);
    expect(res.meta).toMatchObject({ openingBalance: 10, closingBalance: 5 });
    expect(res.issues).toHaveLength(1);

    const regexOnly = await svc.parseText(
      '2024-01-05 Walmart -1.00',
      ['2024-01-05 Walmart -1.00'],
      ctx(),
    );
    expect(regexOnly.method).toBe('regex');
    expect(calls).toHaveLength(2);
  });

  it('LlmExtractionParser skips empty text', async () => {
    const { llm, calls } = fakeLlm(() => ({}));
    expect(
      await new LlmExtractionParser(llm).parse({
        text: '  ',
        pages: [],
        ctx: ctx(),
      }),
    ).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe('reconciliation', () => {
  it('bank: opening + Σ = closing', () => {
    expect(reconcile([-10, 5.5], 100, 95.5, 'Bank')).toEqual({
      status: 'ok',
      parsedTotal: -4.5,
      diff: 0,
    });
    expect(reconcile([-10], 100, 132.17, 'Bank')).toEqual({
      status: 'mismatch',
      parsedTotal: -10,
      diff: -42.17,
    });
  });
  it('card: opening owed − Σ = closing owed', () => {
    expect(reconcile([-100, 50], 500, 550, 'Credit Card').status).toBe('ok');
  });
  it('unknown without both balances', () => {
    expect(reconcile([-1], null, 5, 'Bank').status).toBe('unknown');
  });
});
