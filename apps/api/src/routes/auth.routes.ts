import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { LoginSchema } from '@ledgr/types';
import { register, login, refresh, logout } from '../services/auth.service.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { env } from '../config/env.js';
import { pool } from '../db/client.js';

export const authRouter = Router();

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
};

authRouter.post('/register', async (req: Request, res: Response) => {
  const body = LoginSchema.parse(req.body);
  const user = await register(body);
  res.status(201).json(user);
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const body = LoginSchema.parse(req.body);
  const { accessToken, refreshToken } = await login(body);
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  res.json({ accessToken });
});

authRouter.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken: string | undefined = req.cookies.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  const { accessToken } = await refresh(refreshToken);
  res.json({ accessToken });
});

authRouter.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const refreshToken: string | undefined = req.cookies.refreshToken;
  await logout(req.userId!, refreshToken ?? '');
  res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);
  res.status(204).send();
});

// ─── Change password ──────────────────────────────────────────────────────────

authRouter.patch('/password', requireAuth, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword and newPassword are required' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }

  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) { res.status(404).json({ error: 'User not found' }); return; }

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash as string);
  if (!valid) { res.status(401).json({ error: 'Current password is incorrect' }); return; }

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.userId]);
  // Invalidate all refresh tokens so other sessions are logged out
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.userId]);
  res.status(204).send();
});

// ─── Delete account ───────────────────────────────────────────────────────────

authRouter.delete('/account', requireAuth, async (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  if (!password) { res.status(400).json({ error: 'password is required' }); return; }

  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) { res.status(404).json({ error: 'User not found' }); return; }

  const valid = await bcrypt.compare(password, rows[0].password_hash as string);
  if (!valid) { res.status(401).json({ error: 'Password is incorrect' }); return; }

  await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);
  res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);
  res.status(204).send();
});
