import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService, pgCode, PG_UNIQUE_VIOLATION } from '../db/db.service';

export const CARD_NAME_RE =
  /card|visa|mastercard|amex|american express|discover/i;

export interface Account {
  id: number;
  accountName: string;
  accountType: string;
}

const toAccount = (r: {
  id: number;
  account_name: string;
  account_type: string;
}): Account => ({
  id: r.id,
  accountName: r.account_name,
  accountType: r.account_type,
});

/** 'Credit Card' if the name looks like a card ("card", Visa, Mastercard, Amex, Discover), else 'Bank'. */
export function accountTypeForName(name: string): string {
  return CARD_NAME_RE.test(name) ? 'Credit Card' : 'Bank';
}

@Injectable()
export class AccountsService {
  constructor(private readonly db: DbService) {}

  async list(): Promise<Account[]> {
    return (
      await this.db.query('SELECT * FROM accounts ORDER BY account_name')
    ).map(toAccount);
  }

  async get(id: number): Promise<Account> {
    const r = await this.db.one('SELECT * FROM accounts WHERE id = $1', [id]);
    if (!r) throw new NotFoundException(`Account ${id} not found`);
    return toAccount(r);
  }

  /** Finds or auto-creates the account for a statement file. */
  async ensure(accountName: string): Promise<Account> {
    await this.db.query(
      'INSERT INTO accounts (account_name, account_type) VALUES ($1, $2) ON CONFLICT (account_name) DO NOTHING',
      [accountName, accountTypeForName(accountName)],
    );
    return toAccount(
      (await this.db.one('SELECT * FROM accounts WHERE account_name = $1', [
        accountName,
      ]))!,
    );
  }

  async update(
    id: number,
    patch: { accountName?: string; accountType?: string },
  ): Promise<Account> {
    await this.get(id);
    try {
      const r = await this.db.one(
        `UPDATE accounts SET account_name = COALESCE($2, account_name), account_type = COALESCE($3, account_type)
         WHERE id = $1 RETURNING *`,
        [id, patch.accountName ?? null, patch.accountType ?? null],
      );
      return toAccount(r);
    } catch (err) {
      if (pgCode(err) === PG_UNIQUE_VIOLATION)
        throw new ConflictException(
          `Account name "${patch.accountName}" already exists`,
        );
      throw err;
    }
  }
}
