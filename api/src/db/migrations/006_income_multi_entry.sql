-- Migration: 006_income_multi_entry
-- Allows multiple income entries per user per month (salary + freelance + etc.)
-- Drops the unique constraint that enforced one entry per period.

ALTER TABLE income DROP CONSTRAINT IF EXISTS income_user_id_year_month_key;

-- Re-index without uniqueness (the old unique index is also dropped above)
DROP INDEX IF EXISTS idx_income_user_period;
CREATE INDEX IF NOT EXISTS idx_income_user_period ON income(user_id, year, month);
