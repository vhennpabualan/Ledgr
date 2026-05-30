-- Migration: 005_pending_items
-- Global pending items (upcoming expenses not yet paid, e.g. in-transit parcels).
-- Marking one "delivered" auto-creates an expense and removes the pending item.

CREATE TABLE IF NOT EXISTS pending_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 100),
  amount      BIGINT      NOT NULL CHECK (amount > 0 AND amount <= 99999999),
  currency    CHAR(3)     NOT NULL DEFAULT 'PHP',
  category_id UUID        REFERENCES categories(id) ON DELETE SET NULL,
  year        INTEGER     NOT NULL CHECK (year >= 2000),
  month       INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_items_user
  ON pending_items(user_id, year, month);
