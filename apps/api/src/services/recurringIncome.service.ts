import { pool } from '../db/client.js';
import type {
  RecurringIncome,
  CreateRecurringIncomeDTO,
  UpdateRecurringIncomeDTO,
  Income,
} from '@ledgr/types';

function rowToRecurringIncome(row: Record<string, unknown>): RecurringIncome {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    amount: Number(row.amount),
    currency: row.currency as string,
    label: row.label as string,
    frequency: row.frequency as RecurringIncome['frequency'],
    dayOfWeek: row.day_of_week != null ? Number(row.day_of_week) : null,
    dayOfMonth: row.day_of_month != null ? Number(row.day_of_month) : null,
    monthOfYear: row.month_of_year != null ? Number(row.month_of_year) : null,
    startDate: (row.start_date as Date).toISOString().slice(0, 10),
    endDate: row.end_date ? (row.end_date as Date).toISOString().slice(0, 10) : null,
    nextDueDate: (row.next_due_date as Date).toISOString().slice(0, 10),
    lastRunAt: row.last_run_at ? (row.last_run_at as Date).toISOString() : null,
    isPaused: row.is_paused as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

/**
 * Compute the next due date after `from` for a given frequency + anchor day.
 * For biweekly: advances by 14 days from the current due date.
 */
export function computeNextDueDate(
  frequency: RecurringIncome['frequency'],
  currentDue: Date,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  monthOfYear: number | null,
): Date {
  const next = new Date(currentDue);

  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;

    case 'biweekly':
      // Simply advance 14 days — preserves the exact weekday anchor
      next.setDate(next.getDate() + 14);
      break;

    case 'monthly': {
      // Advance to same day next month
      const dom = dayOfMonth ?? next.getDate();
      next.setMonth(next.getMonth() + 1);
      // Clamp to last day of month (e.g. Jan 31 → Feb 28)
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(dom, lastDay));
      break;
    }

    case 'yearly': {
      const dom = dayOfMonth ?? next.getDate();
      const moy = monthOfYear ?? next.getMonth() + 1;
      next.setFullYear(next.getFullYear() + 1);
      next.setMonth(moy - 1);
      const lastDay = new Date(next.getFullYear(), moy, 0).getDate();
      next.setDate(Math.min(dom, lastDay));
      break;
    }
  }

  return next;
}

export async function listRecurringIncome(userId: string): Promise<RecurringIncome[]> {
  const { rows } = await pool.query(
    `SELECT * FROM recurring_income WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId],
  );
  return (rows as Record<string, unknown>[]).map(rowToRecurringIncome);
}

export async function getRecurringIncome(
  userId: string,
  id: string,
): Promise<RecurringIncome | null> {
  const { rows } = await pool.query(
    `SELECT * FROM recurring_income WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  if (rows.length === 0) return null;
  return rowToRecurringIncome(rows[0] as Record<string, unknown>);
}

export async function createRecurringIncome(
  userId: string,
  dto: CreateRecurringIncomeDTO,
): Promise<RecurringIncome> {
  const {
    amount,
    currency = 'PHP',
    label = 'Salary',
    frequency,
    dayOfWeek = null,
    dayOfMonth = null,
    monthOfYear = null,
    startDate,
    endDate = null,
  } = dto;

  // next_due_date = startDate if provided, else today
  const nextDue = startDate ?? new Date().toISOString().slice(0, 10);

  const { rows } = await pool.query(
    `INSERT INTO recurring_income
       (user_id, amount, currency, label, frequency, day_of_week, day_of_month, month_of_year,
        start_date, end_date, next_due_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [userId, amount, currency, label, frequency, dayOfWeek, dayOfMonth, monthOfYear,
     nextDue, endDate, nextDue],
  );
  return rowToRecurringIncome(rows[0] as Record<string, unknown>);
}

export async function updateRecurringIncome(
  userId: string,
  id: string,
  dto: UpdateRecurringIncomeDTO,
): Promise<RecurringIncome | null> {
  const { rows } = await pool.query(
    `UPDATE recurring_income
     SET amount        = COALESCE($3, amount),
         currency      = COALESCE($4, currency),
         label         = COALESCE($5, label),
         frequency     = COALESCE($6, frequency),
         day_of_week   = COALESCE($7, day_of_week),
         day_of_month  = COALESCE($8, day_of_month),
         month_of_year = COALESCE($9, month_of_year),
         end_date      = COALESCE($10, end_date),
         is_paused     = COALESCE($11, is_paused),
         updated_at    = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [
      id, userId,
      dto.amount ?? null,
      dto.currency ?? null,
      dto.label ?? null,
      dto.frequency ?? null,
      dto.dayOfWeek ?? null,
      dto.dayOfMonth ?? null,
      dto.monthOfYear ?? null,
      dto.endDate ?? null,
      dto.isPaused ?? null,
    ],
  );
  if (rows.length === 0) return null;
  return rowToRecurringIncome(rows[0] as Record<string, unknown>);
}

export async function deleteRecurringIncome(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM recurring_income WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Process all due recurring income entries for a user (or all users if userId is null).
 * Creates income entries for any recurring_income where next_due_date <= today and not paused.
 * Returns the number of income entries created.
 */
export async function processDueRecurringIncome(userId?: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);

  const whereClause = userId
    ? `WHERE next_due_date <= $1 AND is_paused = FALSE AND user_id = $2`
    : `WHERE next_due_date <= $1 AND is_paused = FALSE`;

  const params = userId ? [today, userId] : [today];

  const client = await pool.connect();
  let created = 0;

  try {
    await client.query('BEGIN');

    // FOR UPDATE SKIP LOCKED: if two process() calls run concurrently, the second
    // skips rows already locked by the first — prevents duplicate income entries.
    const { rows: dueRows } = await client.query(
      `SELECT * FROM recurring_income ${whereClause} FOR UPDATE SKIP LOCKED`,
      params,
    );

    if (dueRows.length === 0) {
      await client.query('COMMIT');
      return 0;
    }

    for (const row of dueRows as Record<string, unknown>[]) {
      const rec = rowToRecurringIncome(row);

      // Skip if past end_date
      if (rec.endDate && rec.nextDueDate > rec.endDate) continue;

      const dueDate = new Date(rec.nextDueDate);
      const year = dueDate.getFullYear();
      const month = dueDate.getMonth() + 1;

      // Avoid duplicate: check if an income entry from this recurring template already exists
      // for this exact due date period
      const { rows: existing } = await client.query(
        `SELECT id FROM income
         WHERE user_id = $1 AND recurring_id = $2 AND year = $3 AND month = $4`,
        [rec.userId, rec.id, year, month],
      );

      if (existing.length === 0) {
        await client.query(
          `INSERT INTO income (user_id, amount, currency, year, month, label, recurring_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [rec.userId, rec.amount, rec.currency, year, month, rec.label, rec.id],
        );
        created++;
      }

      // Advance next_due_date
      const nextDue = computeNextDueDate(
        rec.frequency,
        dueDate,
        rec.dayOfWeek,
        rec.dayOfMonth,
        rec.monthOfYear,
      );

      await client.query(
        `UPDATE recurring_income
         SET next_due_date = $1, last_run_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [nextDue.toISOString().slice(0, 10), rec.id],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return created;
}

/** Preview the next N due dates for a recurring income schedule. */
export function previewNextDates(
  frequency: RecurringIncome['frequency'],
  startDate: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  monthOfYear: number | null,
  count = 5,
): string[] {
  const dates: string[] = [];
  let current = new Date(startDate);

  for (let i = 0; i < count; i++) {
    dates.push(current.toISOString().slice(0, 10));
    current = computeNextDueDate(frequency, current, dayOfWeek, dayOfMonth, monthOfYear);
  }

  return dates;
}
