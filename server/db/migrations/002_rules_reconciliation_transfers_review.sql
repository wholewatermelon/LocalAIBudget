-- 002: MVP additions (ARCHITECTURE.md "MVP additions" A–E). Idempotent.

-- B. Category rules learned from corrections
CREATE TABLE IF NOT EXISTS category_rules (
  id serial PRIMARY KEY,
  pattern text NOT NULL,
  match_type varchar(16) NOT NULL DEFAULT 'contains',   -- 'contains' | 'starts_with' | 'regex'
  category_id int NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  priority int NOT NULL DEFAULT 0,
  hits int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (pattern, match_type)
);

-- C. Statement reconciliation
ALTER TABLE statement_files ADD COLUMN IF NOT EXISTS period_start date;
ALTER TABLE statement_files ADD COLUMN IF NOT EXISTS period_end date;
ALTER TABLE statement_files ADD COLUMN IF NOT EXISTS opening_balance numeric(12,2);
ALTER TABLE statement_files ADD COLUMN IF NOT EXISTS closing_balance numeric(12,2);
ALTER TABLE statement_files ADD COLUMN IF NOT EXISTS parsed_total numeric(12,2);
ALTER TABLE statement_files ADD COLUMN IF NOT EXISTS reconciliation_status varchar(16) DEFAULT 'unknown';
ALTER TABLE statement_files ADD COLUMN IF NOT EXISTS reconciliation_diff numeric(12,2);

-- D. Transfer pairing  /  E. Review queue
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_pair_id int REFERENCES transactions(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ai_confidence numeric(3,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS transactions_needs_review_idx ON transactions (needs_review) WHERE needs_review;
CREATE INDEX IF NOT EXISTS transactions_transfer_pair_idx ON transactions (transfer_pair_id);

-- Job counters for rules/transfers
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS rules_applied int DEFAULT 0;
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS transfers_matched int DEFAULT 0;
