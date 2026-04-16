import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';

const STATUS_TO_CODE: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  500: 'INTERNAL_ERROR',
};

export function errorHandler(
  err: unknown,
  _req: Request,
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
    res.status(400).json({ error: 'VALIDATION_ERROR', fields });
    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    const errorCode = STATUS_TO_CODE[err.statusCode] ?? 'INTERNAL_ERROR';
    res.status(err.statusCode).json({ error: errorCode, message: err.message });
    return;
  }

  // Unknown / unexpected errors
  if (env.NODE_ENV !== 'production') {
    console.error(err);
  } else {
    // Log without stack trace in production
    console.error(
      err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    );
  }

  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
}
