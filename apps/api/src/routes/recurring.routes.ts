import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createRecurring,
  listRecurring,
  getRecurring,
  updateRecurring,
  deleteRecurring,
  togglePauseRecurring,
  processDueRecurring,
} from '../services/recurring.service.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { logger } from '../lib/logger.js';

export const recurringRouter = Router();

// Cron endpoint - no auth required (protected by optional CRON_SECRET)
recurringRouter.get('/process', async (req: Request, res: Response) => {
  // Optional: verify a cron secret for security
  const cronSecret = req.query.secret ?? req.headers['x-cron-secret'];
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  
  const count = await processDueRecurring();
  logger.info('Cron: Recurring expenses processed', { count });
  res.json({ processed: count, timestamp: new Date().toISOString() });
});

// All other routes require auth
recurringRouter.use(requireAuth);

// ─── Validation schemas ───────────────────────────────────────────────────────

const CreateRecurringSchema = z.object({
  amount: z.number().int().positive().max(99999999),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  categoryId: z.string().uuid(),
  description: z.string().max(500).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

const UpdateRecurringSchema = CreateRecurringSchema.partial().extend({
  isPaused: z.boolean().optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /recurring — create a new recurring expense
recurringRouter.post('/', async (req: Request, res: Response) => {
  const body = CreateRecurringSchema.parse(req.body);
  const recurring = await createRecurring(req.userId!, body);
  logger.info('Recurring expense created', { requestId: req.requestId, recurringId: recurring.id });
  res.status(201).json(recurring);
});

// GET /recurring — list all recurring expenses
recurringRouter.get('/', async (req: Request, res: Response) => {
  const items = await listRecurring(req.userId!);
  res.json(items);
});

// GET /recurring/:id — get a single recurring expense
recurringRouter.get('/:id', async (req: Request, res: Response) => {
  const recurring = await getRecurring(req.params.id, req.userId!);
  res.json(recurring);
});

// PATCH /recurring/:id — update a recurring expense
recurringRouter.patch('/:id', async (req: Request, res: Response) => {
  const body = UpdateRecurringSchema.parse(req.body);
  const recurring = await updateRecurring(req.params.id, req.userId!, body);
  logger.info('Recurring expense updated', { requestId: req.requestId, recurringId: recurring.id });
  res.json(recurring);
});

// DELETE /recurring/:id — delete a recurring expense
recurringRouter.delete('/:id', async (req: Request, res: Response) => {
  await deleteRecurring(req.params.id, req.userId!);
  logger.info('Recurring expense deleted', { requestId: req.requestId, recurringId: req.params.id });
  res.status(204).send();
});

// POST /recurring/:id/toggle — pause/resume a recurring expense
recurringRouter.post('/:id/toggle', async (req: Request, res: Response) => {
  const { isPaused } = req.body as { isPaused?: boolean };
  const recurring = await togglePauseRecurring(req.params.id, req.userId!, isPaused ?? true);
  logger.info('Recurring expense toggled', { 
    requestId: req.requestId, 
    recurringId: recurring.id, 
    isPaused: recurring.isPaused 
  });
  res.json(recurring);
});

// POST /recurring/process — manually trigger processing (for testing/admin)
recurringRouter.post('/process', async (req: Request, res: Response) => {
  const count = await processDueRecurring();
  logger.info('Recurring expenses processed', { requestId: req.requestId, count });
  res.json({ processed: count });
});
