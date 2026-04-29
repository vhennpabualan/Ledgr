import { pool } from '../db/client.js';
import { sumPendingItems } from './pendingItems.service.js';
import type { Income, UpsertIncomeDTO } from '@ledgr/types';

function rowToIncome(row: Record<string, unknown>): Income {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    amount: Number(row.amount),
    currency: row.currency as string,
    year: Number(row.year),
    month: Number(row.month),
    label: row.label as string,
    recurringId: (row.recurring_id as string | null) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/** List all income entries for a given month, newest first. */
export async function listIncome(
  userId: string,
  year: number,
  month: number,
): Promise<Income[]> {
  const { rows } = await pool.query(
    `SELECT * FROM income
     WHERE user_id = $1 AND year = $2 AND month = $3
     ORDER BY created_at ASC`,
    [userId, year, month],
  );
  return (rows as Record<string, unknown>[]).map(rowToIncome);
}

/** Add a new income entry for a month. */
export async function addIncome(
  userId: string,
  dto: UpsertIncomeDTO,
): Promise<Income> {
  const { amount, currency, year, month, label } = dto;
  const { rows } = await pool.query(
    `INSERT INTO income (user_id, amount, currency, year, month, label)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, amount, currency ?? 'PHP', year, month, label ?? 'Income'],
  );
  return rowToIncome(rows[0] as Record<string, unknown>);
}

/** Update an existing income entry. */
export async function updateIncome(
  userId: string,
  id: string,
  dto: Partial<UpsertIncomeDTO>,
): Promise<Income | null> {
  const { rows } = await pool.query(
    `UPDATE income
     SET amount = COALESCE($3, amount),
         label  = COALESCE($4, label),
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, dto.amount ?? null, dto.label ?? null],
  );
  if (rows.length === 0) return null;
  return rowToIncome(rows[0] as Record<string, unknown>);
}

/** Delete a single income entry. */
export async function deleteIncome(
  userId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM income WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return (rowCount ?? 0) > 0;
}

/** Get income + total spent for the month → balance summary. */
export async function getBalanceSummary(
  userId: string,
  year: number,
  month: number,
): Promise<{
  income: Income | null;
  totalIncome: number;
  entries: Income[];
  totalSpent: number;
  pendingTotal: number;
  remaining: number;
  remainingAfterPending: number;
  percentSpent: number;
}> {
  const entries = await listIncome(userId, year, month);
  const totalIncome = entries.reduce((sum, e) => sum + e.amount, 0);

  // Keep `income` as the first/primary entry for backward compat with BalanceSummary type
  const income = entries[0] ?? null;

  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE user_id = $1
       AND EXTRACT(YEAR FROM date) = $2
       AND EXTRACT(MONTH FROM date) = $3
       AND deleted_at IS NULL
       AND wallet_id IS NULL`,
    [userId, year, month],
  );

  const totalSpent = Number(rows[0].total);
  const pendingTotal = await sumPendingItems(userId, year, month);
  const remaining = totalIncome - totalSpent;
  const remainingAfterPending = remaining - pendingTotal;
  const percentSpent = totalIncome > 0 ? (totalSpent / totalIncome) * 100 : 0;

  return {
    income,
    totalIncome,
    entries,
    totalSpent,
    pendingTotal,
    remaining,
    remainingAfterPending,
    percentSpent,
  };
}

// ─── Legacy upsert kept for any existing callers ──────────────────────────────
/** @deprecated Use addIncome instead. Kept for backward compatibility. */
export async function upsertIncome(
  userId: string,
  dto: UpsertIncomeDTO,
): Promise<Income> {
  return addIncome(userId, dto);
}

/** @deprecated Use listIncome instead. */
export async function getIncome(
  userId: string,
  year: number,
  month: number,
): Promise<Income | null> {
  const entries = await listIncome(userId, year, month);
  return entries[0] ?? null;
}
