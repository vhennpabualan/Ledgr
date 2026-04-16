-- Migration: 002_seed_categories
-- Inserts system-default categories (user_id = NULL).
-- Safe to re-run — skips rows that already exist by name.

INSERT INTO categories (name, icon, color)
SELECT name, icon, color FROM (VALUES
  ('Food & Dining',  '🍽️', '#F59E0B'),
  ('Transport',      '🚗', '#3B82F6'),
  ('Housing',        '🏠', '#8B5CF6'),
  ('Health',         '💊', '#EF4444'),
  ('Entertainment',  '🎬', '#EC4899'),
  ('Shopping',       '🛍️', '#10B981'),
  ('Other',          '📦', '#6B7280')
) AS v(name, icon, color)
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.name = v.name AND c.user_id IS NULL
);
