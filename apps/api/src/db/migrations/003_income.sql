-- Migration: 003_income
-- Tracks monthly income entries per user for balance calculation.

CREATE TABLE IF NOT EXISTS income (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     BIGINT      NOT NULL CHECK (amount > 0),
  currency   CHAR(3)     NOT NULL DEFAULT 'PHP',
  year       INTEGER     NOT NULL CHECK (year >= 2000),
  month      INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  label      TEXT        NOT NULL DEFAULT 'Salary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_income_user_period
  ON income(user_id, year, month);
