import { pool } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { createExpense } from './expense.service.js';
import type { RecurringExpense, CreateRecurringDTO, UpdateRecurringDTO } from '@ledgr/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate the next due date based on frequency and current date.
 */
function calculateNextDueDate(
  frequency: RecurringExpense['frequency'],
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
  monthOfYear?: number | null,
  fromDate: Date = new Date()
): Date {
  const next = new Date(fromDate);
  
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
      
    case 'weekly':
      if (dayOfWeek !== null && dayOfWeek !== undefined) {
        const currentDay = next.getDay();
        const daysUntil = (dayOfWeek - currentDay + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntil);
      } else {
        next.setDate(next.getDate() + 7);
      }
      break;
      
    case 'monthly':
      const targetDay = dayOfMonth ?? next.getDate();
      next.setMonth(next.getMonth() + 1);
      // Handle months with fewer days
      const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(targetDay, maxDay));
      break;
      
    case 'yearly':
      const targetMonth = monthOfYear ?? next.getMonth() + 1;
      const targetDayOfYear = dayOfMonth ?? next.getDate();
      next.setFullYear(next.getFullYear() + 1);
      next.setMonth(targetMonth - 1);
      const maxDayYear = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(targetDayOfYear, maxDayYear));
      break;
  }
  
  return next;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function rowToRecurring(row: Record<string, unknown>): RecurringExpense {
  // DATE columns come back as JS Date objects from node-postgres — extract YYYY-MM-DD
  const toDateStr = (v: unknown): string =>
    v instanceof Date ? v.toISOString().slice(0, 10) : (v as string);

  return {
    id: row.id as string,
    userId: row.user_id as string,
    amount: Number(row.amount),
    currency: row.currency as string,
    categoryId: row.category_id as string,
    description: row.description as string | null,
    frequency: row.frequency as RecurringExpense['frequency'],
    dayOfMonth: row.day_of_month as number | null,
    dayOfWeek: row.day_of_week as number | null,
    monthOfYear: row.month_of_year as number | null,
    startDate: toDateStr(row.start_date),
    endDate: row.end_date != null ? toDateStr(row.end_date) : null,
    nextDueDate: toDateStr(row.next_due_date),
    lastRunAt: row.last_run_at != null ? (row.last_run_at as Date).toISOString() : null,
    isPaused: row.is_paused as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Create a new recurring expense template.
 */
export async function createRecurring(
  userId: string,
  input: CreateRecurringDTO
): Promise<RecurringExpense> {
  const { amount, currency, categoryId, description, frequency, dayOfMonth, dayOfWeek, monthOfYear, startDate, endDate } = input;
  
  // Calculate first due date
  const start = startDate ? new Date(startDate) : new Date();
  const nextDue = calculateNextDueDate(frequency, dayOfMonth, dayOfWeek, monthOfYear, start);
  
  const { rows } = await pool.query(
    `INSERT INTO recurring_expenses
       (user_id, amount, currency, category_id, description, frequency, 
        day_of_month, day_of_week, month_of_year, start_date, end_date, next_due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [userId, amount, currency ?? 'PHP', categoryId, description ?? null, frequency,
     dayOfMonth ?? null, dayOfWeek ?? null, monthOfYear ?? null,
     formatDate(start), endDate ?? null, formatDate(nextDue)]
  );
  
  return rowToRecurring(rows[0] as Record<string, unknown>);
}

/**
 * List all recurring expenses for a user.
 */
export async function listRecurring(userId: string): Promise<RecurringExpense[]> {
  const { rows } = await pool.query(
    `SELECT * FROM recurring_expenses
     WHERE user_id = $1
     ORDER BY next_due_date ASC, created_at ASC`,
    [userId]
  );
  
  return rows.map((r) => rowToRecurring(r as Record<string, unknown>));
}

/**
 * Get a single recurring expense.
 */
export async function getRecurring(id: string, userId: string): Promise<RecurringExpense> {
  const { rows } = await pool.query(
    `SELECT * FROM recurring_expenses WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  
  if (rows.length === 0) {
    throw new AppError(404, 'Recurring expense not found');
  }
  
  return rowToRecurring(rows[0] as Record<string, unknown>);
}

/**
 * Update a recurring expense template.
 */
export async function updateRecurring(
  id: string,
  userId: string,
  patch: UpdateRecurringDTO
): Promise<RecurringExpense> {
  const current = await getRecurring(id, userId);
  
  // Build dynamic update
  const updates: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let paramIndex = 1;
  
  const addUpdate = (field: string, value: unknown) => {
    updates.push(`${field} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  };
  
  if (patch.amount !== undefined) addUpdate('amount', patch.amount);
  if (patch.currency !== undefined) addUpdate('currency', patch.currency);
  if (patch.categoryId !== undefined) addUpdate('category_id', patch.categoryId);
  if (patch.description !== undefined) addUpdate('description', patch.description);
  if (patch.frequency !== undefined) addUpdate('frequency', patch.frequency);
  if (patch.dayOfMonth !== undefined) addUpdate('day_of_month', patch.dayOfMonth);
  if (patch.dayOfWeek !== undefined) addUpdate('day_of_week', patch.dayOfWeek);
  if (patch.monthOfYear !== undefined) addUpdate('month_of_year', patch.monthOfYear);
  if (patch.endDate !== undefined) addUpdate('end_date', patch.endDate);
  if (patch.isPaused !== undefined) addUpdate('is_paused', patch.isPaused);
  
  // Recalculate next due date if frequency or timing changed
  if (patch.frequency || patch.dayOfMonth !== undefined || patch.dayOfWeek !== undefined || patch.monthOfYear !== undefined) {
    const newFreq = patch.frequency ?? current.frequency;
    const newDayOfMonth = patch.dayOfMonth ?? current.dayOfMonth;
    const newDayOfWeek = patch.dayOfWeek ?? current.dayOfWeek;
    const newMonthOfYear = patch.monthOfYear ?? current.monthOfYear;
    
    const nextDue = calculateNextDueDate(newFreq, newDayOfMonth, newDayOfWeek, newMonthOfYear);
    addUpdate('next_due_date', formatDate(nextDue));
  }
  
  values.push(id, userId);
  
  const { rows } = await pool.query(
    `UPDATE recurring_expenses SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
     RETURNING *`,
    values
  );
  
  return rowToRecurring(rows[0] as Record<string, unknown>);
}

/**
 * Delete a recurring expense template.
 */
export async function deleteRecurring(id: string, userId: string): Promise<void> {
  const { rowCount } = await pool.query(
    `DELETE FROM recurring_expenses WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  
  if (!rowCount) {
    throw new AppError(404, 'Recurring expense not found');
  }
}

/**
 * Toggle pause state.
 */
export async function togglePauseRecurring(
  id: string,
  userId: string,
  isPaused: boolean
): Promise<RecurringExpense> {
  return updateRecurring(id, userId, { isPaused });
}

/**
 * Process all due recurring expenses.
 * Called by a scheduled job or manually.
 * Returns count of expenses created.
 */
export async function processDueRecurring(): Promise<number> {
  const today = formatDate(new Date());
  
  // Find all due recurring expenses that aren't paused
  const { rows: dueItems } = await pool.query(
    `SELECT * FROM recurring_expenses
     WHERE next_due_date <= $1
       AND is_paused = FALSE
       AND (end_date IS NULL OR end_date >= $1)`,
    [today]
  );
  
  let created = 0;
  
  for (const row of dueItems) {
    const recurring = rowToRecurring(row as Record<string, unknown>);
    
    try {
      // Create the expense with recurring_id link
      await createExpense(recurring.userId, {
        amount: recurring.amount,
        currency: recurring.currency,
        date: recurring.nextDueDate,
        categoryId: recurring.categoryId,
        description: recurring.description ?? undefined,
      }, recurring.id);
      
      // Update next due date
      const nextDue = calculateNextDueDate(
        recurring.frequency,
        recurring.dayOfMonth,
        recurring.dayOfWeek,
        recurring.monthOfYear,
        new Date(recurring.nextDueDate)
      );
      
      await pool.query(
        `UPDATE recurring_expenses
         SET next_due_date = $1, last_run_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [formatDate(nextDue), recurring.id]
      );
      
      created++;
    } catch (err) {
      // Log error but continue processing others
      console.error(`Failed to process recurring expense ${recurring.id}:`, err);
    }
  }
  
  return created;
}
