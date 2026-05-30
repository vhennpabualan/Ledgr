import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const STATUS_TO_CODE: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'root';
      fields[key] = issue.message;
    }
    logger.warn('Validation error', { requestId: req.requestId, fields });
    res.status(400).json({ error: 'VALIDATION_ERROR', fields });
    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    const errorCode = STATUS_TO_CODE[err.statusCode] ?? 'INTERNAL_ERROR';
    if (err.statusCode >= 500) {
      logger.error('Application error', err, { requestId: req.requestId });
    } else {
      logger.warn('Client error', { requestId: req.requestId, statusCode: err.statusCode, message: err.message });
    }
    res.status(err.statusCode).json({ error: errorCode, message: err.message });
    return;
  }

  // Unknown / unexpected errors
  logger.error('Unhandled error', err, { requestId: req.requestId, path: req.path, method: req.method });
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
}
