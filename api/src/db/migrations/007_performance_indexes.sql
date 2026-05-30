-- Migration: 007_performance_indexes
-- Additional indexes for common query patterns

-- Index for budget status queries (spend by category + month)
CREATE INDEX IF NOT EXISTS idx_expenses_budget_query
  ON expenses(user_id, category_id, date)
  WHERE deleted_at IS NULL;

-- Index for income balance queries
CREATE INDEX IF NOT EXISTS idx_income_user_month
  ON income(user_id, year, month);

-- Index for pending items queries
CREATE INDEX IF NOT EXISTS idx_pending_items_user_month
  ON pending_items(user_id, year, month);

-- Index for pending spend by budget
CREATE INDEX IF NOT EXISTS idx_pending_spend_budget
  ON pending_spend(budget_id);

-- Index for category lookups (user's own + system defaults)
CREATE INDEX IF NOT EXISTS idx_categories_user_lookup
  ON categories(user_id)
  WHERE is_archived = FALSE;
