import { accountTypeForName } from '../accounts/accounts.service';
import {
  parseStatementFileName,
  sanitizeFileName,
  selectFilesToProcess,
} from './file-naming';

describe('parseStatementFileName', () => {
  it.each([
    ['Main_Checking_2024-01.pdf', 'Main Checking', '2024-01', 'pdf'],
    [
      'Travel_Rewards_Card_2024-01.txt',
      'Travel Rewards Card',
      '2024-01',
      'txt',
    ],
    [
      'Harbor_Cash_Back_Card_2024-12.csv',
      'Harbor Cash Back Card',
      '2024-12',
      'csv',
    ],
    [
      'Maple_Federal_Checking_2025-01.OFX',
      'Maple Federal Checking',
      '2025-01',
      'ofx',
    ],
    [
      'Harbor_Cash_Back_Card_2024-11.qfx',
      'Harbor Cash Back Card',
      '2024-11',
      'qfx',
    ],
    ['2024-03_Savings.pdf', 'Savings', '2024-03', 'pdf'],
    ['Checking.pdf', 'Checking', null, 'pdf'],
  ])('%s → %s / %s', (file, account, month, type) => {
    const p = parseStatementFileName(file)!;
    expect(p.accountName).toBe(account);
    expect(p.month).toBe(month);
    expect(p.fileType).toBe(type);
  });

  it('ignores invalid month numbers and unsupported extensions', () => {
    expect(parseStatementFileName('Card_2024-13.pdf')!.month).toBeNull();
    expect(parseStatementFileName('notes.docx')).toBeNull();
    expect(parseStatementFileName('.pdf')).toBeNull();
  });
});

describe('accountTypeForName', () => {
  it('detects cards by name', () => {
    expect(accountTypeForName('Travel Rewards Card')).toBe('Credit Card');
    expect(accountTypeForName('Summit Rewards Visa')).toBe('Credit Card');
    expect(accountTypeForName('Main Checking')).toBe('Bank');
  });
});

describe('selectFilesToProcess', () => {
  it('prefers OFX/QFX > CSV > PDF > TXT per basename', () => {
    const files = [
      'Main_Checking_2025-01.pdf',
      'Main_Checking_2025-01.csv',
      'Main_Checking_2025-01.ofx',
      'Card_2025-01.txt',
      'Card_2025-01.pdf',
      'Savings_2025-01.txt',
    ].map((fileName) => ({ fileName }));
    expect(selectFilesToProcess(files).map((f) => f.fileName)).toEqual([
      'Card_2025-01.pdf',
      'Main_Checking_2025-01.ofx',
      'Savings_2025-01.txt',
    ]);
  });
});

describe('sanitizeFileName', () => {
  it('strips paths and unsafe characters', () => {
    expect(sanitizeFileName('..\\..\\evil/Main Checking_2024-01.pdf')).toBe(
      'Main Checking_2024-01.pdf',
    );
    expect(sanitizeFileName('a$b%c.pdf')).toBe('a_b_c.pdf');
    expect(sanitizeFileName('...hidden.pdf')).toBe('hidden.pdf');
  });
});
