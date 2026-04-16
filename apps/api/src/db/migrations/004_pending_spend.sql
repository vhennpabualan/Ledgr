-- Migration: 004_pending_spend
-- Tracks committed-but-not-yet-paid items against a budget (e.g. in-transit parcels).

CREATE TABLE IF NOT EXISTS pending_spend (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget_id   UUID        NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  amount      BIGINT      NOT NULL CHECK (amount > 0 AND amount <= 99999999),
  label       TEXT        NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_spend_budget
  ON pending_spend(budget_id);
