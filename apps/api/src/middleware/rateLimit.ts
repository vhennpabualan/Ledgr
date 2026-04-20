import { env } from '../config/env.js';
import type { Request, Response, NextFunction } from 'express';

/**
 * Simple in-memory rate limiter.
 * For production with multiple instances, use Redis-backed rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests per window per IP */
  max: number;
  /** Optional key prefix for namespacing */
  keyPrefix?: string;
  /** Custom error message */
  message?: string;
  /** Skip rate limiting in development mode (default: false) */
  skipInDev?: boolean;
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyPrefix = 'rl', message = 'Too many requests, please try again later.', skipInDev = false } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (skipInDev && env.NODE_ENV === 'development') {
      next();
      return;
    }
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      // New window
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
      res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', message });
      return;
    }

    entry.count++;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(max - entry.count));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    next();
  };
}

// Pre-configured limiters for common use cases
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 min per IP
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  skipInDev: true,
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  keyPrefix: 'api',
  message: 'Rate limit exceeded. Please slow down.',
  skipInDev: true,
});

// devRateLimit is kept for backwards compatibility but apiRateLimit now handles
// dev skipping natively via skipInDev: true
export const devRateLimit = apiRateLimit;
