import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  CreateExpenseSchema,
  UpdateExpenseSchema,
  ExpenseFiltersSchema,
} from '@ledgr/types';
import {
  createExpense,
  listExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
} from '../services/expense.service.js';
import { generatePresignedUploadUrl, deleteReceiptByUrl } from '../services/storage.service.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const expenseRouter = Router();

// All expense routes require authentication
expenseRouter.use(requireAuth);

// POST /expenses — create a new expense
expenseRouter.post('/', async (req: Request, res: Response) => {
  const body = CreateExpenseSchema.parse(req.body);
  const expense = await createExpense(req.userId!, body);
  res.status(201).json(expense);
});

// GET /expenses — list expenses with optional filters
expenseRouter.get('/', async (req: Request, res: Response) => {
  // Query params arrive as strings — coerce numeric fields before parsing
  const raw = {
    from: req.query.from,
    to: req.query.to,
    // categoryIds may come as ?categoryIds[]=uuid or ?categoryIds=uuid
    categoryIds: req.query.categoryIds
      ? (Array.isArray(req.query.categoryIds) ? req.query.categoryIds : [req.query.categoryIds])
      : undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    minAmount: req.query.minAmount ? Number(req.query.minAmount) : undefined,
    maxAmount: req.query.maxAmount ? Number(req.query.maxAmount) : undefined,
  };

  const filters = ExpenseFiltersSchema.parse(raw);
  const result = await listExpenses(req.userId!, filters);
  res.json(result);
});

// GET /expenses/:id — fetch a single expense
expenseRouter.get('/:id', async (req: Request, res: Response) => {
  const expense = await getExpense(req.params.id, req.userId!);
  res.json(expense);
});

// PATCH /expenses/:id — partial update
expenseRouter.patch('/:id', async (req: Request, res: Response) => {
  const body = UpdateExpenseSchema.parse(req.body);
  const expense = await updateExpense(req.params.id, req.userId!, body);
  res.json(expense);
});

// DELETE /expenses/:id — soft-delete
expenseRouter.delete('/:id', async (req: Request, res: Response) => {
  await deleteExpense(req.params.id, req.userId!);
  res.status(204).send();
});

const ReceiptUrlBodySchema = z.object({
  filename: z.string().min(1).max(255),
});

// POST /expenses/:id/receipt-url — generate a pre-signed R2 upload URL
expenseRouter.post('/:id/receipt-url', async (req: Request, res: Response) => {
  // Throws 404 if expense not found or belongs to a different user
  await getExpense(req.params.id, req.userId!);

  const { filename } = ReceiptUrlBodySchema.parse(req.body);
  const result = await generatePresignedUploadUrl(req.userId!, req.params.id, filename);

  res.json(result);
});

// DELETE /expenses/:id/receipt — remove receipt from R2 and clear receiptUrl on the expense
expenseRouter.delete('/:id/receipt', async (req: Request, res: Response) => {
  const expense = await getExpense(req.params.id, req.userId!);

  if (!expense.receiptUrl) {
    res.status(404).json({ message: 'No receipt attached to this expense.' });
    return;
  }

  // Delete from R2 (best-effort — don't fail the request if R2 errors)
  try {
    await deleteReceiptByUrl(expense.receiptUrl);
  } catch {
    // Log but continue — we still want to clear the DB reference
    console.warn(`Failed to delete R2 object for expense ${expense.id}`);
  }

  // Clear the receiptUrl on the expense record
  const updated = await updateExpense(req.params.id, req.userId!, { receiptUrl: null });
  res.json(updated);
});
