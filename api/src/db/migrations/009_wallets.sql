-- Migration: 009_wallets
-- Manually tracked wallet/account balances per user.

CREATE TABLE IF NOT EXISTS wallets (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  balance    BIGINT      NOT NULL DEFAULT 0, -- minor currency units, can be 0 or negative
  currency   CHAR(3)     NOT NULL DEFAULT 'PHP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user
  ON wallets(user_id);
