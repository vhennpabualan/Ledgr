import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/client.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import type { AuthTokens, Credentials, TokenPayload } from '@ledgr/types';

// ─── Token helpers ────────────────────────────────────────────────────────────

function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, env.JWT_SECRET, { expiresIn: '15m' });
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

// ─── Auth Service ─────────────────────────────────────────────────────────────

/**
 * login — verify credentials, issue access + refresh tokens.
 * Stores a bcrypt hash of the refresh token in refresh_tokens for invalidation.
 */
export async function login(credentials: Credentials): Promise<AuthTokens> {
  const { email, password } = credentials;

  const { rows } = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email],
  );

  const user = rows[0];
  const valid =
    user && (await bcrypt.compare(password, user.password_hash as string));

  if (!valid) {
    throw new AppError(401, 'Invalid credentials');
  }

  const accessToken = signAccessToken(user.id as string, user.email as string);
  const refreshToken = signRefreshToken(user.id as string);

  const tokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt],
  );

  return { accessToken, refreshToken };
}

/**
 * refresh — validate refresh token JWT, find matching hash in DB, issue new access token.
 */
export async function refresh(
  refreshToken: string,
): Promise<{ accessToken: string }> {
  let payload: { userId: string };

  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      userId: string;
    };
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  // Find all non-expired tokens for this user and compare hashes
  const { rows } = await pool.query(
    `SELECT id, token_hash FROM refresh_tokens
     WHERE user_id = $1 AND expires_at > NOW()`,
    [payload.userId],
  );

  let matchedRow: { id: string } | null = null;
  for (const row of rows) {
    if (await bcrypt.compare(refreshToken, row.token_hash as string)) {
      matchedRow = row as { id: string };
      break;
    }
  }

  if (!matchedRow) {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  // Fetch user email for the new access token payload
  const userResult = await pool.query(
    'SELECT email FROM users WHERE id = $1',
    [payload.userId],
  );

  const accessToken = signAccessToken(
    payload.userId,
    userResult.rows[0].email as string,
  );

  return { accessToken };
}

/**
 * logout — delete the matching refresh token row; silent if not found.
 */
export async function logout(
  userId: string,
  refreshToken: string,
): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id, token_hash FROM refresh_tokens
     WHERE user_id = $1 AND expires_at > NOW()`,
    [userId],
  );

  for (const row of rows) {
    if (await bcrypt.compare(refreshToken, row.token_hash as string)) {
      await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [row.id]);
      break;
    }
  }
  // No error if token not found — idempotent logout
}

/**
 * validateToken — verify access token JWT and return decoded payload.
 * Throws 401 if invalid or expired.
 */
export async function validateToken(token: string): Promise<TokenPayload> {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
}

/**
 * register — create a new user account.
 * Returns the created user without password_hash.
 * Throws 409 if email already exists.
 */
export async function register(credentials: {
  email: string;
  password: string;
}): Promise<{ id: string; email: string; createdAt: string }> {
  const { email, password } = credentials;

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at AS "createdAt"`,
      [email, passwordHash],
    );
    return rows[0] as { id: string; email: string; createdAt: string };
  } catch (err: unknown) {
    // PostgreSQL unique violation code
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      throw new AppError(409, 'Email already in use');
    }
    throw err;
  }
}
