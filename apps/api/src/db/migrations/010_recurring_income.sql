-- Migration: 010_recurring_income
-- Recurring income templates for auto-generating income entries (e.g. bi-weekly salary)

CREATE TABLE IF NOT EXISTS recurring_income (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Income template fields
  amount        BIGINT      NOT NULL CHECK (amount > 0 AND amount <= 99999999),
  currency      CHAR(3)     NOT NULL DEFAULT 'PHP',
  label         TEXT        NOT NULL DEFAULT 'Salary',
  
  -- Recurrence configuration
  frequency     TEXT        NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'yearly')),
  day_of_week   INTEGER     CHECK (day_of_week BETWEEN 0 AND 6),   -- for weekly/biweekly (0=Sunday)
  day_of_month  INTEGER     CHECK (day_of_month BETWEEN 1 AND 31),  -- for monthly/yearly
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

-- Index for finding due recurring income
CREATE INDEX IF NOT EXISTS idx_recurring_income_due
  ON recurring_income(next_due_date)
  WHERE is_paused = FALSE;

CREATE INDEX IF NOT EXISTS idx_recurring_income_user
  ON recurring_income(user_id);

-- Track which recurring template created each income entry
ALTER TABLE income
  ADD COLUMN IF NOT EXISTS recurring_id UUID REFERENCES recurring_income(id) ON DELETE SET NULL;
