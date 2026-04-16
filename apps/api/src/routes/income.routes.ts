import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { upsertIncome, getIncome, getBalanceSummary } from '../services/income.service.js';

export const incomeRouter = Router();
incomeRouter.use(requireAuth);

const PeriodSchema = z.object({
  year: z.coerce.number().int().min(2000),
  month: z.coerce.number().int().min(1).max(12),
});

const UpsertSchema = z.object({
  amount: z.number().int().positive(),   // minor units
  currency: z.string().length(3).optional(),
  year: z.number().int().min(2000),
  month: z.number().int().min(1).max(12),
  label: z.string().max(100).optional(),
});

// PUT /income — set or update income for a month
incomeRouter.put('/', async (req: Request, res: Response) => {
  const body = UpsertSchema.parse(req.body);
  const income = await upsertIncome(req.userId!, body);
  res.json(income);
});

// GET /income?year=&month= — get income for a month
incomeRouter.get('/', async (req: Request, res: Response) => {
  const { year, month } = PeriodSchema.parse(req.query);
  const income = await getIncome(req.userId!, year, month);
  res.json(income ?? null);
});

// GET /income/balance?year=&month= — income + spent + remaining
incomeRouter.get('/balance', async (req: Request, res: Response) => {
  const { year, month } = PeriodSchema.parse(req.query);
  const summary = await getBalanceSummary(req.userId!, year, month);
  res.json(summary);
});
