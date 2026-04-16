import { pool } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import type { Category } from '@ledgr/types';
import type { CreateCategoryInput } from '@ledgr/types';

// ─── Mapper ───────────────────────────────────────────────────────────────────

export function rowToCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as string,
    userId: row.user_id as string | null,
    name: row.name as string,
    icon: row.icon as string,
    color: row.color as string,
    parentId: row.parent_id as string | null,
    isArchived: row.is_archived as boolean,
  };
}

// ─── Category Service ─────────────────────────────────────────────────────────

/**
 * createCategory — persist a new user-owned category.
 * Rejects if parentId references a category that already has a parent (max depth = 1).
 */
export async function createCategory(
  userId: string,
  input: CreateCategoryInput,
): Promise<Category> {
  const { name, icon, color, parentId } = input;

  if (parentId) {
    const { rows } = await pool.query(
      'SELECT parent_id FROM categories WHERE id = $1',
      [parentId],
    );

    if (rows.length === 0) {
      throw new AppError(400, 'Parent category not found');
    }

    if (rows[0].parent_id !== null) {
      throw new AppError(400, 'Category nesting is limited to one level');
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO categories (user_id, name, icon, color, parent_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, name.trim(), icon, color, parentId ?? null],
  );

  return rowToCategory(rows[0] as Record<string, unknown>);
}

/**
 * listCategories — return all categories visible to the user:
 * their own + system defaults (user_id IS NULL).
 * System defaults come first, then sorted by name ASC.
 */
export async function listCategories(userId: string): Promise<Category[]> {
  const { rows } = await pool.query(
    `SELECT * FROM categories
     WHERE user_id = $1 OR user_id IS NULL
     ORDER BY (user_id IS NULL) DESC, name ASC`,
    [userId],
  );

  return rows.map((row) => rowToCategory(row as Record<string, unknown>));
}

/**
 * getCategory — fetch a single category if it belongs to userId or is a system default.
 * Returns 404 if not found or owned by another user.
 */
export async function getCategory(
  id: string,
  userId: string,
): Promise<Category> {
  const { rows } = await pool.query(
    `SELECT * FROM categories
     WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
    [id, userId],
  );

  if (rows.length === 0) {
    throw new AppError(404, 'Category not found');
  }

  return rowToCategory(rows[0] as Record<string, unknown>);
}

/**
 * archiveCategory — set is_archived = true on a user-owned category.
 * System categories can be archived too (no restriction in spec), but must belong to userId.
 */
export async function archiveCategory(
  id: string,
  userId: string,
): Promise<Category> {
  const { rows } = await pool.query(
    `UPDATE categories
     SET is_archived = TRUE
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId],
  );

  if (rows.length === 0) {
    throw new AppError(404, 'Category not found');
  }

  return rowToCategory(rows[0] as Record<string, unknown>);
}

/**
 * updateCategory — patch name/icon/color/parentId on a user-owned category.
 * Re-validates parent depth if parentId changes.
 * Throws 404 if not found or owned by another user.
 */
export async function updateCategory(
  id: string,
  userId: string,
  patch: Partial<CreateCategoryInput>,
): Promise<Category> {
  if (patch.parentId) {
    const { rows: parentRows } = await pool.query(
      'SELECT parent_id FROM categories WHERE id = $1',
      [patch.parentId],
    );

    if (parentRows.length === 0) {
      throw new AppError(400, 'Parent category not found');
    }

    if (parentRows[0].parent_id !== null) {
      throw new AppError(400, 'Category nesting is limited to one level');
    }
  }

  const { rows } = await pool.query(
    `UPDATE categories
     SET name     = COALESCE($1, name),
         icon     = COALESCE($2, icon),
         color    = COALESCE($3, color),
         parent_id = COALESCE($4, parent_id)
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
    [
      patch.name !== undefined ? patch.name.trim() : null,
      patch.icon ?? null,
      patch.color ?? null,
      patch.parentId ?? null,
      id,
      userId,
    ],
  );

  if (rows.length === 0) {
    throw new AppError(404, 'Category not found');
  }

  return rowToCategory(rows[0] as Record<string, unknown>);
}

/**
 * deleteCategory — hard-delete a user-owned category.
 * Throws 403 for system categories (user_id IS NULL).
 * Throws 404 if not found or owned by another user.
 */
export async function deleteCategory(
  id: string,
  userId: string,
): Promise<void> {
  const { rows } = await pool.query(
    'SELECT user_id FROM categories WHERE id = $1',
    [id],
  );

  if (rows.length === 0) {
    throw new AppError(404, 'Category not found');
  }

  if (rows[0].user_id === null) {
    throw new AppError(403, 'System categories cannot be deleted');
  }

  if (rows[0].user_id !== userId) {
    throw new AppError(404, 'Category not found');
  }

  await pool.query('DELETE FROM categories WHERE id = $1', [id]);
}
