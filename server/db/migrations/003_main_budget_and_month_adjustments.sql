-- 003: main budget (versioned by effective_from) + per-month adjustments (ARCHITECTURE.md section H).
-- Replaces categories.budget_limit. Idempotent.

CREATE TABLE IF NOT EXISTS budget_main_items (
  id serial PRIMARY KEY,
  category_id int NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  effective_from char(7) NOT NULL,          -- 'YYYY-MM'
  amount numeric(12,2),                     -- NULL = removed from the main budget from this month on
  created_at timestamptz DEFAULT now(),
  UNIQUE (category_id, effective_from)
);

CREATE TABLE IF NOT EXISTS budget_month_items (
  id serial PRIMARY KEY,
  month char(7) NOT NULL,
  category_id int NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount numeric(12,2),                     -- required unless hidden
  hidden boolean NOT NULL DEFAULT false,
  note text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (month, category_id),
  CONSTRAINT budget_month_items_amount_or_hidden CHECK (hidden OR amount IS NOT NULL)
);

-- Move existing limits into the main budget, effective from the earliest transaction month (or the current month),
-- then drop the old column. Only spending categories are budgetable.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'categories' AND column_name = 'budget_limit') THEN
    INSERT INTO budget_main_items (category_id, effective_from, amount)
    SELECT c.id,
           COALESCE((SELECT to_char(min(t.transaction_date), 'YYYY-MM') FROM transactions t), to_char(now(), 'YYYY-MM')),
           c.budget_limit
    FROM categories c
    WHERE c.budget_limit > 0 AND NOT COALESCE(c.is_income, false) AND NOT COALESCE(c.is_transfer, false)
    ON CONFLICT (category_id, effective_from) DO NOTHING;
    ALTER TABLE categories DROP COLUMN budget_limit;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS budget_main_items_category_idx ON budget_main_items (category_id, effective_from);
CREATE INDEX IF NOT EXISTS budget_month_items_month_idx ON budget_month_items (month);
