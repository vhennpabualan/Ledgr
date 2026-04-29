ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_wallet
  ON expenses(wallet_id)
  WHERE wallet_id IS NOT NULL;
