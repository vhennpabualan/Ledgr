-- 1. Drop the old unique constraint
ALTER TABLE income
  DROP CONSTRAINT IF EXISTS income_user_id_year_month_key;

-- 2. Add due_date column (nullable — manual income entries don't have one)
ALTER TABLE income
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- 3. Partial unique index: prevents duplicate recurring entries for the same exact due date
CREATE UNIQUE INDEX IF NOT EXISTS idx_income_recurring_due_date
  ON income(user_id, recurring_id, due_date)
  WHERE recurring_id IS NOT NULL AND due_date IS NOT NULL;

-- 4. Backfill due_date for existing recurring income entries using their created_at date
--    (best approximation — they were created on the day they were due)
UPDATE income
SET due_date = DATE(created_at)
WHERE recurring_id IS NOT NULL AND due_date IS NULL;
