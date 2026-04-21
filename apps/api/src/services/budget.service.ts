import { pool } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { appendLedgerEntry } from './expense.service.js';
import { sumPendingSpend } from './pendingSpend.service.js';
import type { Budget, BudgetStatus } from '@ledgr/types';
import type { CreateBudgetInput } from '@ledgr/types';

// ─── Mapper ───────────────────────────────────────────────────────────────────

export function rowToBudget(row: Record<string, unknown>): Budget {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    categoryId: row.category_id as string,
    // BIGINT comes back as string from pg driver — coerce to number
    limitAmount: Number(row.limit_amount),
    currency: row.currency as string,
    year: Number(row.year),
    month: Number(row.month),
    rollover: row.rollover as boolean,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

// ─── Budget Service ───────────────────────────────────────────────────────────

/**
 * createBudget — inserts a budget row + ledger entry in a single transaction.
 * Throws 409 on unique violation (userId, categoryId, year, month).
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export async function createBudget(
  userId: string,
  input: CreateBudgetInput,
): Promise<Budget> {
  const { categoryId, limitAmount, currency, year, month, rollover } = input;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO budgets (user_id, category_id, limit_amount, currency, year, month, rollover)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, categoryId, limitAmount, currency, year, month, rollover],
    );

    const budget = rowToBudget(rows[0] as Record<string, unknown>);

    // Full snapshot as diff on create
    const diff: Record<string, unknown> = {
      id: budget.id,
      userId: budget.userId,
      categoryId: budget.categoryId,
      limitAmount: budget.limitAmount,
      currency: budget.currency,
      year: budget.year,
      month: budget.month,
      rollover: budget.rollover,
      createdAt: budget.createdAt,
    };

    await appendLedgerEntry(client, 'budget', budget.id, 'create', userId, diff);

    await client.query('COMMIT');

    return budget;
  } catch (err: unknown) {
    await client.query('ROLLBACK');

    // PostgreSQL unique violation
    if (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === '23505'
    ) {
      throw new AppError(409, 'Budget already exists for this period');
    }

    throw err;
  } finally {
    client.release();
  }
}

/**
 * getBudgetStatus — fetches the budget and aggregates non-deleted expenses
 * for the same (userId, categoryId, year, month) to compute spend metrics.
 *
 * Requirements: 6.5, 6.6, 6.7
 */
export async function getBudgetStatus(
  budgetId: string,
  userId: string,
): Promise<BudgetStatus> {
  const { rows: budgetRows } = await pool.query(
    `SELECT * FROM budgets WHERE id = $1 AND user_id = $2`,
    [budgetId, userId],
  );

  if (budgetRows.length === 0) {
    throw new AppError(404, 'Budget not found');
  }

  const budget = rowToBudget(budgetRows[0] as Record<string, unknown>);

  const { rows: spendRows } = await pool.query<{ spent: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS spent
     FROM expenses
     WHERE user_id = $1
       AND category_id = $2
       AND EXTRACT(YEAR FROM date) = $3
       AND EXTRACT(MONTH FROM date) = $4
       AND deleted_at IS NULL`,
    [userId, budget.categoryId, budget.year, budget.month],
  );

  const spent = Number(spendRows[0].spent);
  const pending = await sumPendingSpend(budget.id);
  const remaining = budget.limitAmount - spent - pending;
  const percentUsed = (spent / budget.limitAmount) * 100;

  return {
    budget,
    spent,
    pending,
    remaining,
    percentUsed,
    isOverBudget: spent >= budget.limitAmount,
    thresholdReached: percentUsed >= 80,
  };
}

/**
 * deleteBudget — hard-deletes a budget row owned by userId.
 * Throws 404 if not found or wrong user.
 */
export async function deleteBudget(id: string, userId: string): Promise<void> {
  const { rowCount } = await pool.query(
    `DELETE FROM budgets WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );

  if (!rowCount) {
    throw new AppError(404, 'Budget not found');
  }
}


export async function listBudgets(
  userId: string,
  year: number,
  month: number,
): Promise<Budget[]> {
  const { rows } = await pool.query(
    `SELECT * FROM budgets
     WHERE user_id = $1 AND year = $2 AND month = $3
     ORDER BY created_at ASC`,
    [userId, year, month],
  );

  return rows.map((r) => rowToBudget(r as Record<string, unknown>));
}

/**
 * copyBudgets — copies all budgets from (fromYear, fromMonth) into (toYear, toMonth).
 * Skips any category that already has a budget in the target period (no overwrite).
 * Returns the list of newly created budgets.
 */
export async function copyBudgets(
  userId: string,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): Promise<Budget[]> {
  const { rows: source } = await pool.query(
    `SELECT * FROM budgets WHERE user_id = $1 AND year = $2 AND month = $3`,
    [userId, fromYear, fromMonth],
  );

  if (source.length === 0) return [];

  const client = await pool.connect();
  const created: Budget[] = [];

  try {
    await client.query('BEGIN');

    for (const row of source as Record<string, unknown>[]) {
      // Skip if already exists in target period
      const { rows: existing } = await client.query(
        `SELECT id FROM budgets WHERE user_id = $1 AND category_id = $2 AND year = $3 AND month = $4`,
        [userId, row.category_id, toYear, toMonth],
      );
      if (existing.length > 0) continue;

      const { rows: inserted } = await client.query(
        `INSERT INTO budgets (user_id, category_id, limit_amount, currency, year, month, rollover)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, row.category_id, row.limit_amount, row.currency, toYear, toMonth, row.rollover],
      );

      const budget = rowToBudget(inserted[0] as Record<string, unknown>);
      await appendLedgerEntry(client, 'budget', budget.id, 'create', userId, {
        ...budget,
        copiedFrom: { year: fromYear, month: fromMonth },
      });
      created.push(budget);
    }

    await client.query('COMMIT');
    return created;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
