-- Migration: 001_initial_schema
-- Creates all core tables, constraints, and indexes for Ledgr.

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Categories ───────────────────────────────────────────────────────────────
-- user_id NULL = system default category (visible to all users, undeletable)
CREATE TABLE IF NOT EXISTS categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 50),
  icon        TEXT        NOT NULL DEFAULT '',
  color       TEXT        NOT NULL DEFAULT '#6B7280',
  parent_id   UUID        REFERENCES categories(id) ON DELETE SET NULL,
  is_archived BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Expenses ─────────────────────────────────────────────────────────────────
-- amount stored as BIGINT in minor currency units (e.g. centavos for PHP)
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      BIGINT      NOT NULL CHECK (amount > 0 AND amount <= 99999999),
  currency    CHAR(3)     NOT NULL DEFAULT 'PHP',
  date        DATE        NOT NULL,
  category_id UUID        NOT NULL REFERENCES categories(id),
  description TEXT,
  receipt_url TEXT,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Budgets ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  UUID    NOT NULL REFERENCES categories(id),
  limit_amount BIGINT  NOT NULL CHECK (limit_amount > 0),
  currency     CHAR(3) NOT NULL DEFAULT 'PHP',
  year         INTEGER NOT NULL CHECK (year >= 2000),
  month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  rollover     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id, year, month)
);

-- ─── Ledger Entries ───────────────────────────────────────────────────────────
-- Append-only audit log. No FKs intentionally — rows must never be deleted.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT        NOT NULL CHECK (entity_type IN ('expense', 'budget')),
  entity_id   UUID        NOT NULL,
  action      TEXT        NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  user_id     UUID        NOT NULL,
  diff        JSONB       NOT NULL DEFAULT '{}',
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Refresh Tokens ───────────────────────────────────────────────────────────
-- Stored hashes only; used to invalidate sessions on logout.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_expenses_user_date
  ON expenses(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_user_category_date
  ON expenses(user_id, category_id, date);

CREATE INDEX IF NOT EXISTS idx_ledger_entity
  ON ledger_entries(entity_id, entity_type);

-- Partial index: only non-deleted rows — keeps the index small and fast
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at
  ON expenses(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
  ON refresh_tokens(user_id);
