import { pool } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import type { Wallet, CreateWalletDTO, UpdateWalletDTO } from '@ledgr/types';

function rowToWallet(row: Record<string, unknown>): Wallet {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    balance: Number(row.balance),
    currency: row.currency as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function listWallets(userId: string): Promise<Wallet[]> {
  const { rows } = await pool.query(
    'SELECT * FROM wallets WHERE user_id = $1 ORDER BY created_at ASC',
    [userId],
  );
  return (rows as Record<string, unknown>[]).map(rowToWallet);
}

export async function createWallet(userId: string, dto: CreateWalletDTO): Promise<Wallet> {
  const { rows } = await pool.query(
    `INSERT INTO wallets (user_id, name, balance, currency)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, dto.name.trim(), dto.balance, dto.currency ?? 'PHP'],
  );
  return rowToWallet(rows[0] as Record<string, unknown>);
}

export async function updateWallet(id: string, userId: string, dto: UpdateWalletDTO): Promise<Wallet> {
  const { rows } = await pool.query(
    `UPDATE wallets
     SET name     = COALESCE($1, name),
         balance  = COALESCE($2, balance),
         currency = COALESCE($3, currency),
         updated_at = NOW()
     WHERE id = $4 AND user_id = $5
     RETURNING *`,
    [dto.name?.trim() ?? null, dto.balance ?? null, dto.currency ?? null, id, userId],
  );
  if (rows.length === 0) throw new AppError(404, 'Wallet not found');
  return rowToWallet(rows[0] as Record<string, unknown>);
}

export async function deleteWallet(id: string, userId: string): Promise<void> {
  const { rowCount } = await pool.query(
    'DELETE FROM wallets WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  if (!rowCount) throw new AppError(404, 'Wallet not found');
}

/**
 * adjustWalletBalance — adds `delta` (negative to deduct) to a wallet's balance.
 * Must be called inside an existing transaction via the provided client.
 */
export async function adjustWalletBalance(
  client: import('pg').PoolClient,
  walletId: string,
  userId: string,
  delta: number,
): Promise<void> {
  const { rowCount } = await client.query(
    `UPDATE wallets SET balance = balance + $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3`,
    [delta, walletId, userId],
  );
  if (!rowCount) throw new AppError(404, 'Wallet not found');
}
