import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CreateBudgetSchema } from '@ledgr/types';
import { createBudget, listBudgets, getBudgetStatus, deleteBudget, copyBudgets } from '../services/budget.service.js';
import { listPendingSpend, createPendingSpend, deletePendingSpend } from '../services/pendingSpend.service.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const budgetRouter = Router();

budgetRouter.use(requireAuth);

const BudgetQuerySchema = z.object({
  year: z.coerce.number().int().min(2000),
  month: z.coerce.number().int().min(1).max(12),
});

const PendingSpendSchema = z.object({
  amount: z.number().int().positive().max(99999999),
  label: z.string().trim().min(1).max(100),
});

// POST /budgets — create a budget
budgetRouter.post('/', async (req: Request, res: Response) => {
  const body = CreateBudgetSchema.parse(req.body);
  const budget = await createBudget(req.userId!, body);
  res.status(201).json(budget);
});

// GET /budgets — list budgets for a given year/month
budgetRouter.get('/', async (req: Request, res: Response) => {
  const { year, month } = BudgetQuerySchema.parse(req.query);
  const budgets = await listBudgets(req.userId!, year, month);
  res.json(budgets);
});

// GET /budgets/:id/status — get budget spend status
budgetRouter.get('/:id/status', async (req: Request, res: Response) => {
  const status = await getBudgetStatus(req.params.id, req.userId!);
  res.json(status);
});

// DELETE /budgets/:id — delete a budget
budgetRouter.delete('/:id', async (req: Request, res: Response) => {
  await deleteBudget(req.params.id, req.userId!);
  res.status(204).send();
});

const CopyBudgetsSchema = z.object({
  fromYear: z.coerce.number().int().min(2000),
  fromMonth: z.coerce.number().int().min(1).max(12),
  toYear: z.coerce.number().int().min(2000),
  toMonth: z.coerce.number().int().min(1).max(12),
});

// POST /budgets/copy — copy budgets from one period to another
budgetRouter.post('/copy', async (req: Request, res: Response) => {
  const { fromYear, fromMonth, toYear, toMonth } = CopyBudgetsSchema.parse(req.body);
  const created = await copyBudgets(req.userId!, fromYear, fromMonth, toYear, toMonth);
  res.status(201).json({ created: created.length, budgets: created });
});

// GET /budgets/:id/pending — list pending spend items
budgetRouter.get('/:id/pending', async (req: Request, res: Response) => {
  const items = await listPendingSpend(req.params.id, req.userId!);
  res.json(items);
});

// POST /budgets/:id/pending — add a pending spend item
budgetRouter.post('/:id/pending', async (req: Request, res: Response) => {
  const { amount, label } = PendingSpendSchema.parse(req.body);
  const item = await createPendingSpend(req.params.id, req.userId!, amount, label);
  res.status(201).json(item);
});

// DELETE /budgets/:budgetId/pending/:itemId — remove a pending spend item
budgetRouter.delete('/:budgetId/pending/:itemId', async (req: Request, res: Response) => {
  await deletePendingSpend(req.params.itemId, req.userId!);
  res.status(204).send();
});
