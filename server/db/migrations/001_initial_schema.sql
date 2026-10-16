-- 001: bring the hand-made pre-migration schema (categories/accounts/transactions/transaction_splits)
-- to the target state in docs/ARCHITECTURE.md. Idempotent: safe on a fresh DB and on the legacy dev DB.

-- categories ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id serial PRIMARY KEY,
  name varchar(100) UNIQUE NOT NULL,
  budget_limit numeric(12,2) DEFAULT 0,
  is_ai_suggested boolean DEFAULT false
);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_income boolean DEFAULT false;
-- Transfers (card payments, moves between own accounts) are excluded from income AND spending totals.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_transfer boolean DEFAULT false;

INSERT INTO categories (name, is_income, is_transfer) VALUES
  ('Housing', false, false), ('Food', false, false), ('Restaurants', false, false), ('Transport', false, false),
  ('Entertainment', false, false), ('Utilities', false, false), ('Income', true, false), ('Shopping', false, false),
  ('Transfer', false, true), ('Other', false, false)
ON CONFLICT (name) DO NOTHING;
UPDATE categories SET is_income = true WHERE name = 'Income' AND is_income IS DISTINCT FROM true;
UPDATE categories SET is_transfer = true WHERE name = 'Transfer' AND is_transfer IS DISTINCT FROM true;

-- accounts -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
  id serial PRIMARY KEY,
  account_name varchar(100) NOT NULL,
  account_type varchar(50) NOT NULL
);

-- statement_files (before transactions, which references it) ---------------
CREATE TABLE IF NOT EXISTS statement_files (
  id serial PRIMARY KEY,
  month char(7) NOT NULL,
  file_name text NOT NULL,
  file_type varchar(8) NOT NULL,
  account_id int REFERENCES accounts(id),
  size_bytes int,
  uploaded_at timestamptz DEFAULT now(),
  last_processed_at timestamptz,
  last_parse_method varchar(16),
  UNIQUE (month, file_name)
);

-- transactions ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id serial PRIMARY KEY,
  account_id int REFERENCES accounts(id),
  category_id int REFERENCES categories(id),
  transaction_date date NOT NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  is_manual_correction boolean DEFAULT false,
  raw_text text
);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS statement_month char(7);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS statement_file_id int REFERENCES statement_files(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS categorized_by varchar(16);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dedupe_key text UNIQUE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill legacy rows.
UPDATE transactions SET statement_month = to_char(transaction_date, 'YYYY-MM') WHERE statement_month IS NULL;
UPDATE transactions SET categorized_by = CASE WHEN is_manual_correction THEN 'manual' ELSE 'ai' END
  WHERE categorized_by IS NULL AND category_id IS NOT NULL;

-- accounts.account_name UNIQUE. The legacy script inserted the same accounts several times:
-- merge duplicates into the lowest id (re-point references) before adding the constraint.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_account_name_key') THEN
    WITH keep AS (
      SELECT id, min(id) OVER (PARTITION BY account_name) AS keep_id FROM accounts
    )
    UPDATE transactions t SET account_id = keep.keep_id
      FROM keep WHERE t.account_id = keep.id AND keep.id <> keep.keep_id;
    WITH keep AS (
      SELECT id, min(id) OVER (PARTITION BY account_name) AS keep_id FROM accounts
    )
    UPDATE statement_files f SET account_id = keep.keep_id
      FROM keep WHERE f.account_id = keep.id AND keep.id <> keep.keep_id;
    DELETE FROM accounts a USING accounts b WHERE a.account_name = b.account_name AND a.id > b.id;
    ALTER TABLE accounts ADD CONSTRAINT accounts_account_name_key UNIQUE (account_name);
  END IF;
END $$;

-- transaction_splits ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS transaction_splits (
  id serial PRIMARY KEY,
  transaction_id int,
  category_id int REFERENCES categories(id),
  amount numeric(12,2) NOT NULL
);
-- (Re)create the FK with ON DELETE CASCADE (legacy constraint had no action).
ALTER TABLE transaction_splits DROP CONSTRAINT IF EXISTS transaction_splits_transaction_id_fkey;
ALTER TABLE transaction_splits ADD CONSTRAINT transaction_splits_transaction_id_fkey
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;

-- processing_jobs ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processing_jobs (
  id serial PRIMARY KEY,
  type varchar(32) NOT NULL,
  month char(7) NOT NULL,
  mode varchar(16) NOT NULL,
  status varchar(16) NOT NULL,
  total int DEFAULT 0,
  processed int DEFAULT 0,
  inserted int DEFAULT 0,
  skipped_duplicates int DEFAULT 0,
  categorized int DEFAULT 0,
  message text,
  errors jsonb DEFAULT '[]',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz DEFAULT now()
);
-- At most one queued/running job per month (atomic guard behind the API's 409).
CREATE UNIQUE INDEX IF NOT EXISTS processing_jobs_one_active_per_month
  ON processing_jobs (month) WHERE status IN ('queued', 'running');

-- ai_insights ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_insights (
  id serial PRIMARY KEY,
  month char(7) NOT NULL,
  summary text NOT NULL,
  suggestions jsonb NOT NULL DEFAULT '[]',
  model varchar(64),
  created_at timestamptz DEFAULT now()
);

-- indexes ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS transactions_statement_month_idx ON transactions (statement_month);
CREATE INDEX IF NOT EXISTS transactions_category_id_idx ON transactions (category_id);
CREATE INDEX IF NOT EXISTS transactions_statement_file_id_idx ON transactions (statement_file_id);
CREATE INDEX IF NOT EXISTS transaction_splits_transaction_id_idx ON transaction_splits (transaction_id);
CREATE INDEX IF NOT EXISTS ai_insights_month_idx ON ai_insights (month, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_transaction_date_idx ON transactions (transaction_date);
