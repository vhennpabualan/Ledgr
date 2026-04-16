import { pool } from '../db/client.js';
import { rowToExpense } from './expense.service.js';
import type { ReportSummary, TrendPoint, CategoryBreakdown, Expense } from '@ledgr/types';

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/** Escapes a CSV field: wraps in quotes if it contains a comma or quote; doubles any internal quotes. */
function csvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

type GroupBy = 'category' | 'day' | 'week' | 'month';

interface ReportParams {
  from: string;
  to: string;
  groupBy: GroupBy;
  categoryIds?: string[];
}

// ─── getSummary ───────────────────────────────────────────────────────────────

/**
 * Returns totalSpent, category breakdown with percentages, and top 5 expenses.
 * Requirements: 7.1, 7.2, 7.5, 7.6
 */
export async function getSummary(
  userId: string,
  params: ReportParams,
): Promise<ReportSummary> {
  const { from, to, categoryIds } = params;

  // ── Base conditions shared by all queries in this function ──────────────────
  const baseConditions = [
    'e.user_id = $1',
    'e.date >= $2',
    'e.date <= $3',
    'e.deleted_at IS NULL',
  ];
  const baseParams: unknown[] = [userId, from, to];

  let categoryFilter = '';
  if (categoryIds?.length) {
    baseParams.push(categoryIds);
    categoryFilter = `AND e.category_id = ANY($${baseParams.length}::uuid[])`;
  }

  const where = baseConditions.join(' AND ');

  // ── 1. Total spent ──────────────────────────────────────────────────────────
  const { rows: totalRows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(e.amount), 0) AS total
     FROM expenses e
     WHERE ${where} ${categoryFilter}`,
    baseParams,
  );
  const totalSpent = Number(totalRows[0].total);

  // ── 2. Breakdown by category ────────────────────────────────────────────────
  const { rows: breakdownRows } = await pool.query<{
    category_id: string;
    category_name: string;
    total_spent: string;
  }>(
    `SELECT c.id AS category_id, c.name AS category_name, SUM(e.amount) AS total_spent
     FROM expenses e
     JOIN categories c ON e.category_id = c.id
     WHERE ${where} ${categoryFilter}
     GROUP BY c.id, c.name
     ORDER BY total_spent DESC`,
    baseParams,
  );

  const breakdown: CategoryBreakdown[] = breakdownRows.map((row) => {
    const rowTotal = Number(row.total_spent);
    return {
      categoryId: row.category_id,
      categoryName: row.category_name,
      totalSpent: rowTotal,
      percentage: totalSpent > 0 ? (rowTotal / totalSpent) * 100 : 0,
    };
  });

  // ── 3. Top 5 expenses by amount ─────────────────────────────────────────────
  const { rows: topRows } = await pool.query(
    `SELECT * FROM expenses e
     WHERE ${where} ${categoryFilter}
     ORDER BY e.amount DESC, e.date DESC
     LIMIT 5`,
    baseParams,
  );
  const topExpenses: Expense[] = topRows.map((r) =>
    rowToExpense(r as Record<string, unknown>),
  );

  return { totalSpent, currency: 'PHP', breakdown, topExpenses };
}

// ─── getTrend ─────────────────────────────────────────────────────────────────

/**
 * Returns time-series (or category-series) spending data points.
 * Requirements: 7.3, 7.5, 7.6
 */
export async function getTrend(
  userId: string,
  params: ReportParams,
): Promise<TrendPoint[]> {
  const { from, to, groupBy, categoryIds } = params;

  const baseParams: unknown[] = [userId, from, to];

  let categoryFilter = '';
  if (categoryIds?.length) {
    baseParams.push(categoryIds);
    categoryFilter = `AND e.category_id = ANY($${baseParams.length}::uuid[])`;
  }

  const baseWhere = `
    e.user_id = $1
    AND e.deleted_at IS NULL
    AND e.date >= $2
    AND e.date <= $3
    ${categoryFilter}
  `;

  let query: string;

  if (groupBy === 'category') {
    // Group by category — label is category name
    query = `
      SELECT c.name AS label, SUM(e.amount) AS total_spent
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      WHERE ${baseWhere}
      GROUP BY c.id, c.name
      ORDER BY c.name ASC
    `;
  } else {
    // Time-based grouping — label is a date string
    const dateTrunc: Record<Exclude<GroupBy, 'category'>, string> = {
      day:   `TO_CHAR(e.date, 'YYYY-MM-DD')`,
      week:  `TO_CHAR(DATE_TRUNC('week', e.date), 'YYYY-MM-DD')`,
      month: `TO_CHAR(e.date, 'YYYY-MM')`,
    };
    const labelExpr = dateTrunc[groupBy as Exclude<GroupBy, 'category'>];

    query = `
      SELECT ${labelExpr} AS label, SUM(e.amount) AS total_spent
      FROM expenses e
      WHERE ${baseWhere}
      GROUP BY label
      ORDER BY label ASC
    `;
  }

  const { rows } = await pool.query<{ label: string; total_spent: string }>(
    query,
    baseParams,
  );

  return rows.map((row) => ({
    label: row.label,
    totalSpent: Number(row.total_spent),
  }));
}

// ─── exportCSV ────────────────────────────────────────────────────────────────

/**
 * Builds a CSV string of all non-deleted expenses for the user in the given
 * date range. Amounts are converted from minor units (centavos) to pesos.
 * Requirements: 7.4
 */
export async function exportCSV(
  userId: string,
  params: { from: string; to: string; categoryIds?: string[] },
): Promise<string> {
  const { from, to, categoryIds } = params;

  const queryParams: unknown[] = [userId, from, to];

  let categoryFilter = '';
  if (categoryIds?.length) {
    queryParams.push(categoryIds);
    categoryFilter = `AND e.category_id = ANY($${queryParams.length}::uuid[])`;
  }

  const { rows } = await pool.query<{
    date: string;
    amount: string;
    currency: string;
    category_name: string;
    description: string | null;
  }>(
    `SELECT
       TO_CHAR(e.date, 'YYYY-MM-DD') AS date,
       e.amount,
       e.currency,
       c.name AS category_name,
       e.description
     FROM expenses e
     JOIN categories c ON e.category_id = c.id
     WHERE e.user_id = $1
       AND e.date >= $2
       AND e.date <= $3
       AND e.deleted_at IS NULL
       ${categoryFilter}
     ORDER BY e.date DESC, e.created_at DESC`,
    queryParams,
  );

  const header = 'date,amount,currency,category,description';

  const dataRows = rows.map((row) => {
    const amount = (Number(row.amount) / 100).toFixed(2);
    const description = row.description ?? '';
    return [
      csvField(row.date),
      csvField(amount),
      csvField(row.currency),
      csvField(row.category_name),
      csvField(description),
    ].join(',');
  });

  return [header, ...dataRows].join('\n');
}
