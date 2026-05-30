import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listPendingItems,
  createPendingItem,
  deletePendingItem,
  deliverPendingItem,
} from '../services/pendingItems.service.js';

export const pendingItemsRouter = Router();
pendingItemsRouter.use(requireAuth);

const QuerySchema = z.object({
  year:  z.coerce.number().int().min(2000),
  month: z.coerce.number().int().min(1).max(12),
});

const CreateSchema = z.object({
  label:      z.string().trim().min(1).max(100),
  amount:     z.number().int().positive().max(99999999),
  currency:   z.string().regex(/^[A-Z]{3}$/).default('PHP'),
  categoryId: z.string().uuid().optional(),
  year:       z.number().int().min(2000),
  month:      z.number().int().min(1).max(12),
});

// GET /pending?year=&month=
pendingItemsRouter.get('/', async (req: Request, res: Response) => {
  const { year, month } = QuerySchema.parse(req.query);
  const items = await listPendingItems(req.userId!, year, month);
  res.json(items);
});

// POST /pending
pendingItemsRouter.post('/', async (req: Request, res: Response) => {
  const { label, amount, currency, categoryId, year, month } = CreateSchema.parse(req.body);
  const item = await createPendingItem(req.userId!, label, amount, currency, categoryId ?? null, year, month);
  res.status(201).json(item);
});

// DELETE /pending/:id
pendingItemsRouter.delete('/:id', async (req: Request, res: Response) => {
  await deletePendingItem(req.params.id, req.userId!);
  res.status(204).send();
});

// POST /pending/:id/deliver — convert to expense
pendingItemsRouter.post('/:id/deliver', async (req: Request, res: Response) => {
  const result = await deliverPendingItem(req.params.id, req.userId!);
  res.json(result);
});
