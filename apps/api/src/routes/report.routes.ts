import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { getSummary, getTrend, exportCSV } from '../services/report.service.js';

export const reportRouter = Router();

// All report routes require authentication
reportRouter.use(requireAuth);

const ReportQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  groupBy: z.enum(['category', 'day', 'week', 'month']).default('month'),
  // ?categoryIds[]=uuid or ?categoryIds=uuid
  categoryIds: z.array(z.string().uuid()).optional(),
});

/** Coerce categoryIds from query string into an array (handles both ?categoryIds[]=x and ?categoryIds=x) */
function coerceCategoryIds(raw: unknown): string[] | undefined {
  if (!raw) return undefined;
  return Array.isArray(raw) ? (raw as string[]) : [raw as string];
}

// GET /reports/summary
reportRouter.get('/summary', async (req: Request, res: Response) => {
  const params = ReportQuerySchema.parse({
    from: req.query.from,
    to: req.query.to,
    groupBy: req.query.groupBy,
    categoryIds: coerceCategoryIds(req.query.categoryIds),
  });
  const summary = await getSummary(req.userId!, params);
  res.json(summary);
});

// GET /reports/trend
reportRouter.get('/trend', async (req: Request, res: Response) => {
  const params = ReportQuerySchema.parse({
    from: req.query.from,
    to: req.query.to,
    groupBy: req.query.groupBy,
    categoryIds: coerceCategoryIds(req.query.categoryIds),
  });
  const trend = await getTrend(req.userId!, params);
  res.json(trend);
});

const ExportQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  categoryIds: z.array(z.string().uuid()).optional(),
});

// GET /reports/export
reportRouter.get('/export', async (req: Request, res: Response) => {
  const params = ExportQuerySchema.parse({
    from: req.query.from,
    to: req.query.to,
    categoryIds: coerceCategoryIds(req.query.categoryIds),
  });
  const csv = await exportCSV(req.userId!, params);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="ledgr-export.csv"');
  res.send(csv);
});
