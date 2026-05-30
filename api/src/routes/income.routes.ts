import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listIncome,
  addIncome,
  updateIncome,
  deleteIncome,
  getBalanceSummary,
  // legacy
  upsertIncome,
  getIncome,
} from '../services/income.service.js';

export const incomeRouter = Router();
incomeRouter.use(requireAuth);

const PeriodSchema = z.object({
  year: z.coerce.number().int().min(2000),
  month: z.coerce.number().int().min(1).max(12),
});

const AddSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().length(3).optional(),
  year: z.number().int().min(2000),
  month: z.number().int().min(1).max(12),
  label: z.string().min(1).max(100).optional(),
});

const PatchSchema = z.object({
  amount: z.number().int().positive().optional(),
  label: z.string().min(1).max(100).optional(),
});

// ─── Multi-entry endpoints ────────────────────────────────────────────────────

// GET /income/entries?year=&month= — list all entries for a month
incomeRouter.get('/entries', async (req: Request, res: Response) => {
  const { year, month } = PeriodSchema.parse(req.query);
  const entries = await listIncome(req.userId!, year, month);
  res.json(entries);
});

// POST /income/entries — add a new income entry
incomeRouter.post('/entries', async (req: Request, res: Response) => {
  const body = AddSchema.parse(req.body);
  const entry = await addIncome(req.userId!, body);
  res.status(201).json(entry);
});

// PATCH /income/entries/:id — update label or amount
incomeRouter.patch('/entries/:id', async (req: Request, res: Response) => {
  const body = PatchSchema.parse(req.body);
  const entry = await updateIncome(req.userId!, req.params.id, body);
  if (!entry) return res.status(404).json({ message: 'Income entry not found.' });
  res.json(entry);
});

// DELETE /income/entries/:id — remove a single entry
incomeRouter.delete('/entries/:id', async (req: Request, res: Response) => {
  const deleted = await deleteIncome(req.userId!, req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Income entry not found.' });
  res.status(204).send();
});

// ─── Balance ──────────────────────────────────────────────────────────────────

// GET /income/balance?year=&month=
incomeRouter.get('/balance', async (req: Request, res: Response) => {
  const { year, month } = PeriodSchema.parse(req.query);
  const summary = await getBalanceSummary(req.userId!, year, month);
  res.json(summary);
});

// ─── Legacy endpoints (kept for backward compat) ─────────────────────────────

// PUT /income — legacy single-entry upsert
incomeRouter.put('/', async (req: Request, res: Response) => {
  const body = AddSchema.parse(req.body);
  const income = await upsertIncome(req.userId!, body);
  res.json(income);
});

// GET /income?year=&month= — legacy single entry get
incomeRouter.get('/', async (req: Request, res: Response) => {
  const { year, month } = PeriodSchema.parse(req.query);
  const income = await getIncome(req.userId!, year, month);
  res.json(income ?? null);
});
