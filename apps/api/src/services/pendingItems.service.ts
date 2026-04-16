import { pool } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import type { PendingItem } from '@ledgr/types';

function rowToItem(row: Record<string, unknown>): PendingItem {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    label: row.label as string,
    amount: Number(row.amount),
    currency: row.currency as string,
    categoryId: (row.category_id as string | null) ?? null,
    year: Number(row.year),
    month: Number(row.month),
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function listPendingItems(
  userId: string,
  year: number,
  month: number,
): Promise<PendingItem[]> {
  const { rows } = await pool.query(
    `SELECT * FROM pending_items
     WHERE user_id = $1 AND year = $2 AND month = $3
     ORDER BY created_at ASC`,
    [userId, year, month],
  );
  return rows.map((r) => rowToItem(r as Record<string, unknown>));
}

export async function createPendingItem(
  userId: string,
  label: string,
  amount: number,
  currency: string,
  categoryId: string | null,
  year: number,
  month: number,
): Promise<PendingItem> {
  const { rows } = await pool.query(
    `INSERT INTO pending_items (user_id, label, amount, currency, category_id, year, month)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [userId, label, amount, currency, categoryId ?? null, year, month],
  );
  return rowToItem(rows[0] as Record<string, unknown>);
}

export async function deletePendingItem(id: string, userId: string): Promise<void> {
  const { rowCount } = await pool.query(
    `DELETE FROM pending_items WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  if (!rowCount) throw new AppError(404, 'Pending item not found');
}

/**
 * deliverPendingItem — atomically:
 *   1. Fetches the pending item (404 if not found / wrong user)
 *   2. Creates an expense with today's date in the item's category
 *   3. Deletes the pending item
 * Returns the created expense id.
 */
export async function deliverPendingItem(
  id: string,
  userId: string,
): Promise<{ expenseId: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch item
    const { rows: itemRows } = await client.query(
      `SELECT * FROM pending_items WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    if (itemRows.length === 0) throw new AppError(404, 'Pending item not found');
    const item = rowToItem(itemRows[0] as Record<string, unknown>);

    if (!item.categoryId) {
      throw new AppError(400, 'Pending item has no category — assign one before marking delivered.');
    }

    // 2. Create expense with today's local date
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const { rows: expRows } = await client.query(
      `INSERT INTO expenses (user_id, amount, currency, date, category_id, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [userId, item.amount, item.currency, dateStr, item.categoryId, item.label],
    );
    const expenseId = (expRows[0] as { id: string }).id;

    // 3. Delete pending item
    await client.query(`DELETE FROM pending_items WHERE id = $1`, [id]);

    await client.query('COMMIT');
    return { expenseId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Sum of all pending item amounts for a user/month — used by balance summary */
export async function sumPendingItems(
  userId: string,
  year: number,
  month: number,
): Promise<number> {
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM pending_items
     WHERE user_id = $1 AND year = $2 AND month = $3`,
    [userId, year, month],
  );
  return Number(rows[0].total);
}
