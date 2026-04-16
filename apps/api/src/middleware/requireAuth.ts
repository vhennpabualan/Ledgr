import type { Request, Response, NextFunction } from 'express';
import { validateToken } from '../services/auth.service.js';

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = await validateToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'UNAUTHORIZED' });
  }
}
