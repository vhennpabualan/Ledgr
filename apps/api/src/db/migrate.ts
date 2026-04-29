/**
 * migrate.ts — applies all SQL migrations in order against the DB.
 * Usage: npx ts-node src/db/migrate.ts
 *
 * Files run (in order, single transaction):
 *   001_initial_schema.sql  — DDL: tables, indexes
 *   002_seed_categories.sql — DML: system-default categories
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './client.js';

const MIGRATIONS = [
  '001_initial_schema.sql',
  '002_seed_categories.sql',
  '003_income.sql',
  '004_pending_spend.sql',
  '005_pending_items.sql',
  '006_income_multi_entry.sql',
  '007_performance_indexes.sql',
  '008_recurring_expenses.sql',
  '009_wallets.sql',
  '010_recurring_income.sql',
  '011_income_biweekly_fix.sql',
];

async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const filename of MIGRATIONS) {
      const sqlPath = join(__dirname, 'migrations', filename);
      const sql = readFileSync(sqlPath, 'utf-8');
      await client.query(sql);
      console.log(`  ✓ ${filename}`);
    }
    await client.query('COMMIT');
    console.log('All migrations applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed — rolled back.', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
