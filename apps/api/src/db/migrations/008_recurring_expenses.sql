-- Migration: 008_recurring_expenses
-- Recurring expense templates for auto-generating expenses

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Expense template fields
  amount        BIGINT      NOT NULL CHECK (amount > 0 AND amount <= 99999999),
  currency      CHAR(3)     NOT NULL DEFAULT 'PHP',
  category_id   UUID        NOT NULL REFERENCES categories(id),
  description   TEXT,
  
  -- Recurrence configuration
  frequency     TEXT        NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  day_of_month  INTEGER     CHECK (day_of_month BETWEEN 1 AND 31),  -- for monthly/yearly
  day_of_week   INTEGER     CHECK (day_of_week BETWEEN 0 AND 6),   -- for weekly (0=Sunday)
  month_of_year INTEGER     CHECK (month_of_year BETWEEN 1 AND 12), -- for yearly
  
  -- Scheduling
  start_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  end_date      DATE,       -- NULL = indefinite
  next_due_date DATE        NOT NULL,
  last_run_at   TIMESTAMPTZ,
  
  -- State
  is_paused     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for finding due recurring expenses
CREATE INDEX IF NOT EXISTS idx_recurring_due
  ON recurring_expenses(next_due_date)
  WHERE is_paused = FALSE;

CREATE INDEX IF NOT EXISTS idx_recurring_user
  ON recurring_expenses(user_id);

-- Track which recurring template created each expense
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS recurring_id UUID REFERENCES recurring_expenses(id) ON DELETE SET NULL;
