import type { PoolClient } from 'pg';
import { pool } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import type { Expense, LedgerEntry, PaginatedResult } from '@ledgr/types';
import type { CreateExpenseInput, UpdateExpenseInput, ExpenseFiltersInput } from '@ledgr/types';

// ─── Mapper ───────────────────────────────────────────────────────────────────

export function rowToExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    // BIGINT comes back as string from pg driver — coerce to number (safe: max 99_999_999)
    amount: Number(row.amount),
    currency: row.currency as string,
    // DATE columns come back as JS Date objects at local midnight — use local
    // date parts to avoid UTC conversion shifting the day (e.g. UTC+8 → -1 day)
    date: row.date instanceof Date
      ? `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, '0')}-${String(row.date.getDate()).padStart(2, '0')}`
      : (row.date as string),
    categoryId: row.category_id as string,
    description: row.description as string | null,
    receiptUrl: row.receipt_url as string | null,
    splits: [], // always empty in v1
    deletedAt: row.deleted_at != null
      ? (row.deleted_at as Date).toISOString()
      : null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

// ─── Ledger Helper ────────────────────────────────────────────────────────────

/**
 * appendLedgerEntry — inserts a single ledger row using an existing client
 * (must be called inside an open transaction).
 */
export async function appendLedgerEntry(
  client: PoolClient,
  entityType: LedgerEntry['entityType'],
  entityId: string,
  action: LedgerEntry['action'],
  userId: string,
  diff: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO ledger_entries (entity_type, entity_id, action, user_id, diff)
     VALUES ($1, $2, $3, $4, $5)`,
    [entityType, entityId, action, userId, JSON.stringify(diff)],
  );
}

// ─── Expense Service ──────────────────────────────────────────────────────────

/**
 * createExpense — validates category ownership, inserts expense + ledger entry
 * in a single transaction, and returns the created expense.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 11.4
 */
export async function createExpense(
  userId: string,
  input: CreateExpenseInput,
): Promise<Expense> {
  const { amount, date, categoryId, description, receiptUrl } = input;
  const currency = input.currency ?? 'PHP';

  // ── 1. Verify category is accessible to this user (owned or system default) ──
  const { rows: catRows } = await pool.query(
    `SELECT id FROM categories
     WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
    [categoryId, userId],
  );

  if (catRows.length === 0) {
    throw new AppError(400, 'Invalid category');
  }

  // ── 2. Transaction: INSERT expense → INSERT ledger entry ──────────────────
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO expenses
         (user_id, amount, currency, date, category_id, description, receipt_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        amount,
        currency,
        date,
        categoryId,
        description ?? null,
        receiptUrl ?? null,
      ],
    );

    const expense = rowToExpense(rows[0] as Record<string, unknown>);

    // Full snapshot as diff on create
    const diff: Record<string, unknown> = {
      id: expense.id,
      userId: expense.userId,
      amount: expense.amount,
      currency: expense.currency,
      date: expense.date,
      categoryId: expense.categoryId,
      description: expense.description,
      receiptUrl: expense.receiptUrl,
      splits: [],
      deletedAt: expense.deletedAt,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    };

    await appendLedgerEntry(client, 'expense', expense.id, 'create', userId, diff);

    await client.query('COMMIT');

    return expense;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * listExpenses — returns a paginated, filtered list of non-deleted expenses
 * belonging to the authenticated user.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export async function listExpenses(
  userId: string,
  filters: ExpenseFiltersInput,
): Promise<PaginatedResult<Expense>> {
  const { from, to, categoryIds, minAmount, maxAmount, page } = filters;

  // Cap pageSize at 100 regardless of what the caller passes
  const pageSize = Math.min(filters.pageSize, 100);
  const offset = (page - 1) * pageSize;

  // Build dynamic WHERE clause — $1 is always userId
  const conditions: string[] = ['user_id = $1', 'deleted_at IS NULL'];
  const params: unknown[] = [userId];

  function addParam(value: unknown): string {
    params.push(value);
    return `$${params.length}`;
  }

  if (from !== undefined)          conditions.push(`date >= ${addParam(from)}`);
  if (to !== undefined)            conditions.push(`date <= ${addParam(to)}`);
  if (categoryIds?.length)         conditions.push(`category_id = ANY(${addParam(categoryIds)}::uuid[])`);
  if (minAmount !== undefined)     conditions.push(`amount >= ${addParam(minAmount)}`);
  if (maxAmount !== undefined)     conditions.push(`amount <= ${addParam(maxAmount)}`);

  const where = conditions.join(' AND ');

  // COUNT query — same WHERE, no LIMIT/OFFSET
  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM expenses WHERE ${where}`,
    params,
  );
  const total = parseInt(countRows[0].count, 10);

  // Data query
  const limitParam  = addParam(pageSize);
  const offsetParam = addParam(offset);

  const { rows } = await pool.query(
    `SELECT * FROM expenses
     WHERE ${where}
     ORDER BY date DESC, created_at DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params,
  );

  return {
    data: rows.map((r) => rowToExpense(r as Record<string, unknown>)),
    total,
    page,
    pageSize,
  };
}

/**
 * getExpense — fetch a single non-deleted expense owned by userId.
 * Returns 404 for both "not found" and "wrong user" (req 11.3).
 *
 * Requirements: 3.5, 11.3
 */
export async function getExpense(id: string, userId: string): Promise<Expense> {
  const { rows } = await pool.query(
    `SELECT * FROM expenses
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, userId],
  );

  if (rows.length === 0) {
    throw new AppError(404, 'Expense not found');
  }

  return rowToExpense(rows[0] as Record<string, unknown>);
}

/**
 * updateExpense — apply a partial patch to an existing expense.
 * Only changed fields are recorded in the ledger diff.
 *
 * Requirements: 4.1, 4.2, 4.3, 11.3
 */
export async function updateExpense(
  id: string,
  userId: string,
  patch: UpdateExpenseInput,
): Promise<Expense> {
  // Throws 404 if not found or wrong user
  const current = await getExpense(id, userId);

  // If categoryId is changing, verify the new category is accessible
  if (patch.categoryId !== undefined && patch.categoryId !== current.categoryId) {
    const { rows: catRows } = await pool.query(
      `SELECT id FROM categories
       WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
      [patch.categoryId, userId],
    );
    if (catRows.length === 0) {
      throw new AppError(400, 'Invalid category');
    }
  }

  // Build diff — only fields that actually changed
  const diff: Record<string, unknown> = {};
  if (patch.amount    !== undefined && patch.amount    !== current.amount)      diff.amount      = patch.amount;
  if (patch.currency  !== undefined && patch.currency  !== current.currency)    diff.currency    = patch.currency;
  if (patch.date      !== undefined && patch.date      !== current.date)        diff.date        = patch.date;
  if (patch.categoryId !== undefined && patch.categoryId !== current.categoryId) diff.categoryId = patch.categoryId;
  // description/receiptUrl can be null — compare with explicit undefined check
  if (patch.description !== undefined && patch.description !== current.description)   diff.description = patch.description;
  if (patch.receiptUrl  !== undefined && patch.receiptUrl  !== current.receiptUrl)    diff.receiptUrl  = patch.receiptUrl;

  // Nothing actually changed — return current without touching DB
  if (Object.keys(diff).length === 0) {
    return current;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE expenses
       SET
         amount      = COALESCE($3, amount),
         currency    = COALESCE($4, currency),
         date        = COALESCE($5, date),
         category_id = COALESCE($6, category_id),
         description = CASE WHEN $7::boolean THEN $8 ELSE description END,
         receipt_url = CASE WHEN $9::boolean THEN $10 ELSE receipt_url END,
         updated_at  = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        id,
        userId,
        patch.amount      ?? null,
        patch.currency    ?? null,
        patch.date        ?? null,
        patch.categoryId  ?? null,
        patch.description !== undefined,  // $7 — whether to overwrite description
        patch.description ?? null,        // $8
        patch.receiptUrl  !== undefined,  // $9 — whether to overwrite receiptUrl
        patch.receiptUrl  ?? null,        // $10
      ],
    );

    const updated = rowToExpense(rows[0] as Record<string, unknown>);

    await appendLedgerEntry(client, 'expense', id, 'update', userId, diff);

    await client.query('COMMIT');

    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * deleteExpense — soft-delete by setting deleted_at = NOW().
 * Appends a ledger entry with the deletion timestamp.
 *
 * Requirements: 4.4, 4.5
 */
export async function deleteExpense(id: string, userId: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE expenses
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id, deleted_at`,
      [id, userId],
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      throw new AppError(404, 'Expense not found');
    }

    const deletedAt = (rows[0] as { deleted_at: Date }).deleted_at.toISOString();

    await appendLedgerEntry(client, 'expense', id, 'delete', userId, { deletedAt });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
