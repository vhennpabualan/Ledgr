import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Adds a unique request ID to every request for tracing.
 * Uses X-Request-ID header if present (from load balancer), otherwise generates one.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'];
  const id = typeof existingId === 'string' ? existingId : randomUUID();
  
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

// Extend Express Request type
declare module 'express' {
  interface Request {
    requestId?: string;
  }
}
