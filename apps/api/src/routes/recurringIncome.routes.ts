import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listRecurringIncome,
  getRecurringIncome,
  createRecurringIncome,
  updateRecurringIncome,
  deleteRecurringIncome,
  processDueRecurringIncome,
  previewNextDates,
} from '../services/recurringIncome.service.js';

export const recurringIncomeRouter = Router();
recurringIncomeRouter.use(requireAuth);

const FrequencyEnum = z.enum(['weekly', 'biweekly', 'monthly', 'yearly']);

const CreateSchema = z.object({
  amount: z.number().int().positive().max(99999999),
  currency: z.string().length(3).optional(),
  label: z.string().min(1).max(100).optional(),
  frequency: FrequencyEnum,
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

const UpdateSchema = CreateSchema.partial().extend({
  isPaused: z.boolean().optional(),
});

const PreviewSchema = z.object({
  frequency: FrequencyEnum,
  startDate: z.string().date(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  monthOfYear: z.coerce.number().int().min(1).max(12).optional(),
  count: z.coerce.number().int().min(1).max(12).optional(),
});

// GET /recurring-income — list all
recurringIncomeRouter.get('/', async (req: Request, res: Response) => {
  const items = await listRecurringIncome(req.userId!);
  res.json(items);
});

// GET /recurring-income/preview — preview next N due dates (no DB write)
recurringIncomeRouter.get('/preview', async (req: Request, res: Response) => {
  const { frequency, startDate, dayOfWeek, dayOfMonth, monthOfYear, count } =
    PreviewSchema.parse(req.query);
  const dates = previewNextDates(
    frequency,
    startDate,
    dayOfWeek ?? null,
    dayOfMonth ?? null,
    monthOfYear ?? null,
    count ?? 5,
  );
  res.json({ dates });
});

// GET /recurring-income/:id — single
recurringIncomeRouter.get('/:id', async (req: Request, res: Response) => {
  const item = await getRecurringIncome(req.userId!, req.params.id);
  if (!item) return res.status(404).json({ message: 'Not found.' });
  res.json(item);
});

// POST /recurring-income — create
recurringIncomeRouter.post('/', async (req: Request, res: Response) => {
  const body = CreateSchema.parse(req.body);
  const item = await createRecurringIncome(req.userId!, body);
  res.status(201).json(item);
});

// PATCH /recurring-income/:id — update
recurringIncomeRouter.patch('/:id', async (req: Request, res: Response) => {
  const body = UpdateSchema.parse(req.body);
  const item = await updateRecurringIncome(req.userId!, req.params.id, body);
  if (!item) return res.status(404).json({ message: 'Not found.' });
  res.json(item);
});

// DELETE /recurring-income/:id — delete
recurringIncomeRouter.delete('/:id', async (req: Request, res: Response) => {
  const deleted = await deleteRecurringIncome(req.userId!, req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Not found.' });
  res.status(204).send();
});

// POST /recurring-income/process — manually trigger processing (useful for testing / cron)
recurringIncomeRouter.post('/process', async (req: Request, res: Response) => {
  const count = await processDueRecurringIncome(req.userId!);
  res.json({ created: count });
});
