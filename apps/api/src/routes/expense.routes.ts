import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
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
import { scanReceipt } from '../services/receiptScan.service.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { env } from '../config/env.js';

export const expenseRouter = Router();
expenseRouter.use(requireAuth);

// Multer — memory storage, 10 MB limit, images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are supported for receipt scanning.'));
  },
});

// ─── Static routes (must come before /:id) ───────────────────────────────────

// POST /expenses/scan-receipt — scan an image and extract expense data via Gemini
expenseRouter.post(
  '/scan-receipt',
  upload.single('receipt'),
  async (req: Request, res: Response) => {
    if (!env.GEMINI_API_KEY) {
      res.status(503).json({ message: 'Receipt scanning is not configured on this server.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: 'No image file provided.' });
      return;
    }
    const result = await scanReceipt(req.file.buffer, req.file.mimetype);
    if (!result) {
      res.status(503).json({ message: 'Receipt scanning unavailable.' });
      return;
    }
    res.json(result);
  },
);

// POST /expenses — create a new expense
expenseRouter.post('/', async (req: Request, res: Response) => {
  const body = CreateExpenseSchema.parse(req.body);
  const expense = await createExpense(req.userId!, body);
  res.status(201).json(expense);
});

// GET /expenses — list expenses with optional filters
expenseRouter.get('/', async (req: Request, res: Response) => {
  const raw = {
    from: req.query.from,
    to: req.query.to,
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

// ─── Parameterised routes ─────────────────────────────────────────────────────

// GET /expenses/:id
expenseRouter.get('/:id', async (req: Request, res: Response) => {
  const expense = await getExpense(req.params.id, req.userId!);
  res.json(expense);
});

// PATCH /expenses/:id
expenseRouter.patch('/:id', async (req: Request, res: Response) => {
  const body = UpdateExpenseSchema.parse(req.body);
  const expense = await updateExpense(req.params.id, req.userId!, body);
  res.json(expense);
});

// DELETE /expenses/:id
expenseRouter.delete('/:id', async (req: Request, res: Response) => {
  await deleteExpense(req.params.id, req.userId!);
  res.status(204).send();
});

const ReceiptUrlBodySchema = z.object({
  filename: z.string().min(1).max(255),
});

// POST /expenses/:id/receipt-url — generate a pre-signed R2 upload URL
expenseRouter.post('/:id/receipt-url', async (req: Request, res: Response) => {
  await getExpense(req.params.id, req.userId!);
  const { filename } = ReceiptUrlBodySchema.parse(req.body);
  const result = await generatePresignedUploadUrl(req.userId!, req.params.id, filename);
  res.json(result);
});

// DELETE /expenses/:id/receipt — remove receipt from R2 and clear receiptUrl
expenseRouter.delete('/:id/receipt', async (req: Request, res: Response) => {
  const expense = await getExpense(req.params.id, req.userId!);

  if (!expense.receiptUrl) {
    res.status(404).json({ message: 'No receipt attached to this expense.' });
    return;
  }

  try {
    await deleteReceiptByUrl(expense.receiptUrl);
  } catch {
    console.warn(`Failed to delete R2 object for expense ${expense.id}`);
  }

  const updated = await updateExpense(req.params.id, req.userId!, { receiptUrl: null });
  res.json(updated);
});
