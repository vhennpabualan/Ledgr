import { Router } from 'express';
import type { Request, Response } from 'express';
import { LoginSchema } from '@ledgr/types';
import { register, login, refresh, logout } from '../services/auth.service.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { env } from '../config/env.js';

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
