import { pool } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import type { PendingSpend } from '@ledgr/types';

function rowToPending(row: Record<string, unknown>): PendingSpend {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    budgetId: row.budget_id as string,
    amount: Number(row.amount),
    label: row.label as string,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

/** Verify the budget exists and belongs to userId */
async function assertBudgetOwner(budgetId: string, userId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id FROM budgets WHERE id = $1 AND user_id = $2`,
    [budgetId, userId],
  );
  if (rows.length === 0) throw new AppError(404, 'Budget not found');
}

export async function listPendingSpend(
  budgetId: string,
  userId: string,
): Promise<PendingSpend[]> {
  await assertBudgetOwner(budgetId, userId);
  const { rows } = await pool.query(
    `SELECT * FROM pending_spend WHERE budget_id = $1 ORDER BY created_at ASC`,
    [budgetId],
  );
  return rows.map((r) => rowToPending(r as Record<string, unknown>));
}

export async function createPendingSpend(
  budgetId: string,
  userId: string,
  amount: number,
  label: string,
): Promise<PendingSpend> {
  await assertBudgetOwner(budgetId, userId);
  const { rows } = await pool.query(
    `INSERT INTO pending_spend (user_id, budget_id, amount, label)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, budgetId, amount, label],
  );
  return rowToPending(rows[0] as Record<string, unknown>);
}

export async function deletePendingSpend(
  id: string,
  userId: string,
): Promise<void> {
  const { rowCount } = await pool.query(
    `DELETE FROM pending_spend WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  if (!rowCount) throw new AppError(404, 'Pending item not found');
}

/** Sum of all pending amounts for a budget — used by getBudgetStatus */
export async function sumPendingSpend(budgetId: string): Promise<number> {
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM pending_spend WHERE budget_id = $1`,
    [budgetId],
  );
  return Number(rows[0].total);
}
