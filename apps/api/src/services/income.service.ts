import { pool } from '../db/client.js';
import { AppError } from '../lib/errors.js';
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
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/** Upsert income for a given month — one entry per user per month. */
export async function upsertIncome(
  userId: string,
  dto: UpsertIncomeDTO,
): Promise<Income> {
  const { amount, currency, year, month, label } = dto;

  const { rows } = await pool.query(
    `INSERT INTO income (user_id, amount, currency, year, month, label)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, year, month)
     DO UPDATE SET
       amount     = EXCLUDED.amount,
       currency   = EXCLUDED.currency,
       label      = EXCLUDED.label,
       updated_at = NOW()
     RETURNING *`,
    [userId, amount, currency ?? 'PHP', year, month, label ?? 'Salary'],
  );

  return rowToIncome(rows[0] as Record<string, unknown>);
}

/** Get income for a specific month. Returns null if not set. */
export async function getIncome(
  userId: string,
  year: number,
  month: number,
): Promise<Income | null> {
  const { rows } = await pool.query(
    `SELECT * FROM income WHERE user_id = $1 AND year = $2 AND month = $3`,
    [userId, year, month],
  );

  if (rows.length === 0) return null;
  return rowToIncome(rows[0] as Record<string, unknown>);
}

/** Get income + total spent for the month → balance summary. */
export async function getBalanceSummary(
  userId: string,
  year: number,
  month: number,
): Promise<{
  income: Income | null;
  totalSpent: number;
  pendingTotal: number;
  remaining: number;
  remainingAfterPending: number;
  percentSpent: number;
}> {
  const income = await getIncome(userId, year, month);

  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE user_id = $1
       AND EXTRACT(YEAR FROM date) = $2
       AND EXTRACT(MONTH FROM date) = $3
       AND deleted_at IS NULL`,
    [userId, year, month],
  );

  const totalSpent = Number(rows[0].total);
  const pendingTotal = await sumPendingItems(userId, year, month);
  const incomeAmount = income?.amount ?? 0;
  const remaining = incomeAmount - totalSpent;
  const remainingAfterPending = remaining - pendingTotal;
  const percentSpent = incomeAmount > 0 ? (totalSpent / incomeAmount) * 100 : 0;

  return { income, totalSpent, pendingTotal, remaining, remainingAfterPending, percentSpent };
}
